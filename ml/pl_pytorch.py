"""
Implémentation PyTorch Plackett-Luce avec embeddings cheval/jockey/trainer.
Phase recherche — remplace LightGBM quand les embeddings apportent un gain mesurable.
"""
from __future__ import annotations

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader


class RaceDataset(Dataset):
    """
    Un sample = une course.
    race_groups : list of dicts with keys:
      features   : Tensor[n_runners, n_feat]
      ranks      : Tensor[n_runners] — position finale, NaN = DNF
      horse_ids  : Tensor[n_runners] (int)
      jockey_ids : Tensor[n_runners] (int)
      trainer_ids: Tensor[n_runners] (int)
      race_id    : str
    """
    def __init__(self, race_groups: list[dict]):
        self.races = race_groups

    def __len__(self):
        return len(self.races)

    def __getitem__(self, i):
        return self.races[i]


def collate_races(batch):
    return batch  # Each race has variable n_runners — no padding needed


class PLScorer(nn.Module):
    """
    Convertit features + embeddings en score scalaire par partant.
    Extend en remplaçant self.net par Set Transformer ou GNN pour interactions inter-chevaux.
    """
    def __init__(
        self,
        n_feat: int,
        hidden: int = 128,
        n_horses: int = 60_000,
        n_jockeys: int = 6_000,
        n_trainers: int = 4_000,
        emb_dim: int = 16,
    ):
        super().__init__()
        self.horse_emb = nn.Embedding(n_horses, emb_dim, padding_idx=0)
        self.jockey_emb = nn.Embedding(n_jockeys, emb_dim, padding_idx=0)
        self.trainer_emb = nn.Embedding(n_trainers, emb_dim, padding_idx=0)

        in_dim = n_feat + 3 * emb_dim
        self.net = nn.Sequential(
            nn.Linear(in_dim, hidden), nn.GELU(),
            nn.Dropout(0.2),
            nn.Linear(hidden, hidden // 2), nn.GELU(),
            nn.Linear(hidden // 2, 1),
        )
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                nn.init.zeros_(m.bias)

    def forward(
        self,
        feats: torch.Tensor,
        horse_ids: torch.Tensor,
        jockey_ids: torch.Tensor,
        trainer_ids: torch.Tensor,
    ) -> torch.Tensor:
        emb = torch.cat([
            self.horse_emb(horse_ids),
            self.jockey_emb(jockey_ids),
            self.trainer_emb(trainer_ids),
        ], dim=-1)
        x = torch.cat([feats, emb], dim=-1)
        return self.net(x).squeeze(-1)  # [n_runners]


def plackett_luce_topk_nll(scores: torch.Tensor, ranks: torch.Tensor, k: int = 5) -> torch.Tensor:
    """
    NLL Plackett-Luce top-k.
    scores : [n_runners] raw (avant exp)
    ranks  : [n_runners] position finale — NaN = DNF (exclus de la cascade)
    """
    finite_mask = ~torch.isnan(ranks)
    scores_f = scores[finite_mask]
    ranks_f = ranks[finite_mask]

    if len(scores_f) < 2:
        return torch.zeros((), device=scores.device, requires_grad=True)

    order = torch.argsort(ranks_f)
    sorted_scores = scores_f[order]

    K = min(k, len(sorted_scores))
    nll = torch.zeros((), device=scores.device)

    for i in range(K):
        remaining = sorted_scores[i:]
        nll = nll - sorted_scores[i] + torch.logsumexp(remaining, dim=0)

    # Régularisation douce DNF : chaque DNF devait être battu par les K finishers
    if (~finite_mask).any():
        dnf_scores = scores[~finite_mask]
        for i in range(min(K, 3)):  # top-3 seulement pour éviter l'overfit
            nll = nll + 0.05 * torch.logsumexp(
                torch.cat([sorted_scores[i:i + 1], dnf_scores]), dim=0
            )

    return nll


def train_loop(
    model: PLScorer,
    train_loader: DataLoader,
    val_loader: DataLoader,
    epochs: int = 30,
    lr: float = 1e-3,
    k: int = 5,
):
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-5)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    best_val = float("inf")
    best_state = None

    for epoch in range(epochs):
        model.train()
        total_loss = 0.0

        for races_batch in train_loader:
            opt.zero_grad()
            batch_loss = torch.zeros((), device=next(model.parameters()).device)
            for race in races_batch:
                scores = model(race["features"], race["horse_ids"], race["jockey_ids"], race["trainer_ids"])
                batch_loss = batch_loss + plackett_luce_topk_nll(scores, race["ranks"], k=k)
            (batch_loss / len(races_batch)).backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step()
            total_loss += batch_loss.item() / len(races_batch)

        sched.step()
        val_nll = evaluate(model, val_loader, k)

        if val_nll < best_val:
            best_val = val_nll
            best_state = {k2: v.clone() for k2, v in model.state_dict().items()}

        print(f"[epoch {epoch:3d}] train_nll={total_loss / len(train_loader):.4f}  val_nll={val_nll:.4f}")

    if best_state:
        model.load_state_dict(best_state)
    return model


@torch.no_grad()
def evaluate(model: PLScorer, loader: DataLoader, k: int = 5) -> float:
    model.eval()
    total, n = 0.0, 0
    for races_batch in loader:
        for race in races_batch:
            scores = model(race["features"], race["horse_ids"], race["jockey_ids"], race["trainer_ids"])
            total += plackett_luce_topk_nll(scores, race["ranks"], k=k).item()
            n += 1
    return total / max(n, 1)
