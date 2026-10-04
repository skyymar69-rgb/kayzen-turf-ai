import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { adresseAppelant, limiterDebit, reponseTropDeRequetes } from "../src/lib/rate-limit";

// Le compteur vit au niveau du module : chaque test prend une clé qui lui est
// propre pour ne pas hériter des appels d'un autre.
let cle = 0;
const nouvelleCle = () => `test:${cle++}`;

describe("limiterDebit", () => {
  beforeEach(() => mock.timers.enable({ apis: ["Date"], now: 1_000_000 }));
  afterEach(() => mock.timers.reset());

  it("autorise jusqu'à la limite, puis refuse", () => {
    const id = nouvelleCle();
    assert.deepEqual(limiterDebit(id, 3, 60_000), { autorise: true, restant: 2, reessayerDans: 0 });
    assert.equal(limiterDebit(id, 3, 60_000).restant, 1);
    assert.equal(limiterDebit(id, 3, 60_000).restant, 0);
    const refus = limiterDebit(id, 3, 60_000);
    assert.equal(refus.autorise, false);
    assert.equal(refus.restant, 0);
    assert.equal(refus.reessayerDans, 60);
  });

  it("annonce le temps restant avant réouverture, arrondi à la seconde supérieure", () => {
    const id = nouvelleCle();
    limiterDebit(id, 1, 60_000);
    mock.timers.tick(20_500);
    assert.equal(limiterDebit(id, 1, 60_000).reessayerDans, 40);
  });

  it("rouvre une fenêtre neuve une fois la précédente échue", () => {
    const id = nouvelleCle();
    limiterDebit(id, 1, 60_000);
    assert.equal(limiterDebit(id, 1, 60_000).autorise, false);
    mock.timers.tick(60_000);
    assert.deepEqual(limiterDebit(id, 1, 60_000), { autorise: true, restant: 0, reessayerDans: 0 });
  });

  it("compte chaque clé séparément", () => {
    const a = nouvelleCle();
    const b = nouvelleCle();
    limiterDebit(a, 1, 60_000);
    assert.equal(limiterDebit(a, 1, 60_000).autorise, false);
    assert.equal(limiterDebit(b, 1, 60_000).autorise, true);
  });

  it("garde des compteurs justes au fil des purges amorties", () => {
    // 600 clés distinctes dépassent le seuil de purge : la purge tourne, sans
    // effacer les fenêtres encore ouvertes.
    const suivie = nouvelleCle();
    limiterDebit(suivie, 2, 60_000);
    for (let i = 0; i < 600; i += 1) limiterDebit(nouvelleCle(), 5, 60_000);
    assert.equal(limiterDebit(suivie, 2, 60_000).restant, 0);
    assert.equal(limiterDebit(suivie, 2, 60_000).autorise, false);
  });
});

describe("adresseAppelant", () => {
  const requete = (headers: Record<string, string>) => new Request("https://exemple.test/api", { headers });

  it("préfère x-vercel-forwarded-for, posé par l'edge", () => {
    assert.equal(
      adresseAppelant(requete({ "x-vercel-forwarded-for": "203.0.113.7", "x-forwarded-for": "198.51.100.1" })),
      "203.0.113.7",
    );
  });

  it("ne garde que la première entrée de x-forwarded-for", () => {
    assert.equal(adresseAppelant(requete({ "x-forwarded-for": " 198.51.100.1 , 10.0.0.1" })), "198.51.100.1");
  });

  it("se rabat sur x-real-ip, puis sur une clé unique", () => {
    assert.equal(adresseAppelant(requete({ "x-real-ip": "192.0.2.9" })), "192.0.2.9");
    assert.equal(adresseAppelant(requete({})), "inconnu");
  });
});

describe("reponseTropDeRequetes", () => {
  it("répond 429 avec Retry-After et sans cache", async () => {
    const reponse = reponseTropDeRequetes({ autorise: false, restant: 0, reessayerDans: 12 });
    assert.equal(reponse.status, 429);
    assert.equal(reponse.headers.get("Retry-After"), "12");
    assert.equal(reponse.headers.get("Cache-Control"), "no-store");
    assert.match((await reponse.json()).error, /Trop de requêtes/);
  });

  it("n'annonce jamais moins d'une seconde", () => {
    assert.equal(reponseTropDeRequetes({ autorise: false, restant: 0, reessayerDans: 0 }).headers.get("Retry-After"), "1");
  });
});
