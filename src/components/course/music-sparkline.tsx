import { tokenizeMusic } from "@/lib/prediction-math";

/**
 * Musique en courbe : une place par course, la plus récente à droite.
 * Lit la musique avec le même découpage que le modèle (`tokenizeMusic`), pour
 * qu'un « (25) » de changement d'année ou un « a » d'attelé ne devienne pas
 * une place.
 */
export function MusicSparkline({ music }: { music?: string | null }) {
  const values = tokenizeMusic(music, 8).map((t) => (t.kind === "pos" ? t.value : 10)).reverse();
  if (values.length < 2) return <span className="text-xs text-muted">{music || "—"}</span>;

  const W = 72;
  const H = 20;
  const PAD = 2;
  const coords = values.map((v, i) => [PAD + (i / (values.length - 1)) * (W - PAD * 2), PAD + ((v - 1) / 9) * (H - PAD * 2)] as const);
  const recent = values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, values.length);
  const stroke = recent <= 3 ? "var(--accent)" : recent <= 6 ? "var(--warn)" : "var(--danger)";
  const d = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  return (
    <span className="inline-flex items-center gap-1.5" title={music ?? ""}>
      <svg aria-hidden="true" className="shrink-0" height={H} viewBox={`0 0 ${W} ${H}`} width={W}>
        <path d={d} fill="none" stroke={stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <circle cx={coords.at(-1)![0]} cy={coords.at(-1)![1]} r="2" fill={stroke} />
      </svg>
      <span className="max-w-[120px] truncate font-mono text-xs text-muted">{music}</span>
    </span>
  );
}
