import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Audit d'accessibilité automatique (axe-core) sur les pages les plus vues.
 *
 * Seules les violations d'impact « serious » ou « critical » font échouer le
 * test : ce sont celles qui bloquent un utilisateur (contraste insuffisant,
 * contrôle sans nom, structure ARIA invalide…). Aucune règle n'est désactivée ;
 * les violations mineures restent visibles dans le rapport joint au test.
 *
 * axe ne couvre qu'une partie du RGAA : ce test est un filet, pas un audit de
 * conformité.
 */

const NORMES = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const BLOQUANTES = new Set(["serious", "critical"]);

async function auditer(page: Page, titre: string) {
  // Le rendu client (hydratation, bannière cookies) doit être posé avant l'audit.
  await page.waitForLoadState("networkidle");
  const resultat = await new AxeBuilder({ page }).withTags(NORMES).analyze();

  await test.info().attach(`axe-${titre}.json`, {
    body: JSON.stringify(resultat.violations, null, 2),
    contentType: "application/json",
  });

  // Une ligne par élément fautif — règle, impact, sélecteur — plutôt que l'objet
  // axe complet : le message d'échec se lit d'un coup d'œil.
  const bloquantes = resultat.violations
    .filter((v) => BLOQUANTES.has(v.impact ?? ""))
    .flatMap((v) => v.nodes.map((n) => `[${v.impact}] ${v.id} — ${n.target.join(" ")} — ${v.help}`));
  expect(bloquantes, `Violations bloquantes sur ${titre}`).toEqual([]);
}

test("accueil", async ({ page }) => {
  await page.goto("/");
  await auditer(page, "accueil");
});

test("page course", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Analyse complète" }).first().click();
  await expect(page).toHaveURL(/\/races\/R\d+C\d+-/);
  await auditer(page, "course");
});

test("/pronostics", async ({ page }) => {
  await page.goto("/pronostics");
  await auditer(page, "pronostics");
});

test("/methode", async ({ page }) => {
  await page.goto("/methode");
  await auditer(page, "methode");
});
