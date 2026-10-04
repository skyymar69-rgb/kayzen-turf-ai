import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeLabel, normalizeTicket, parseTicketParams, pmuTicketText, ticketImagePath } from "../src/lib/ticket-format";

describe("format texte PMU", () => {
  it("écrit le pari puis les numéros séparés par des tirets", () => {
    assert.equal(pmuTicketText("Quinté+", [4, 8, 2, 11, 6]), "Quinté+ 4-8-2-11-6");
    assert.equal(pmuTicketText("Couplé gagnant", "4 - 8"), "Couplé gagnant 4-8");
    assert.equal(pmuTicketText("Trio", "2-3 X"), "Trio 2-3-X");
  });
});

describe("validation des paramètres de l'image", () => {
  it("accepte les tickets réels, ordre et X compris", () => {
    assert.equal(normalizeTicket("4-8-2-11-6"), "4-8-2-11-6");
    assert.equal(normalizeTicket(" 4 - 8 ordre "), "4-8 ordre");
    assert.equal(normalizeTicket("2 x x x"), "2-X-X-X");
  });

  it("refuse tout le reste", () => {
    for (const bad of ["", "0-4", "100-2", "4-8-<b>", "javascript:alert(1)", "4--", "-4", "4;8", "a-b"]) {
      assert.equal(normalizeTicket(bad), null, bad);
    }
    assert.equal(normalizeTicket(Array.from({ length: 21 }, (_, i) => (i % 9) + 1).join("-")), null);
    assert.equal(normalizeTicket(null), null);
  });

  it("borne le libellé en longueur et en caractères", () => {
    assert.equal(normalizeLabel("Quinté+"), "Quinté+");
    assert.equal(normalizeLabel("2 sur 4"), "2 sur 4");
    assert.equal(normalizeLabel("<script>"), null);
    assert.equal(normalizeLabel("x".repeat(41)), null);
    assert.equal(normalizeLabel("   "), null);
  });

  it("exige les deux paramètres valides", () => {
    assert.deepEqual(parseTicketParams("4-8", "Couplé gagnant"), { ticket: "4-8", label: "Couplé gagnant" });
    assert.equal(parseTicketParams("4-8", null), null);
    assert.equal(parseTicketParams("zz", "Trio"), null);
  });

  it("construit une URL encodée", () => {
    assert.equal(ticketImagePath("R1C3-2026-10-04", "4-8", "Quinté+"), "/races/R1C3-2026-10-04/ticket?t=4-8&k=Quint%C3%A9%2B");
  });
});
