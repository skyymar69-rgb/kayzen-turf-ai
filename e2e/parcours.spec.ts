import { expect, test } from "@playwright/test";

/**
 * Parcours principaux, en mode démonstration (aucune base) : les courses
 * fictives de src/lib/mock-data.ts, datées du jour courant. Les tests ne
 * visent aucune course précise : une course de démonstration ajoutée ou
 * retirée ne doit pas les casser.
 *
 * Localisateurs par rôle et libellé français, comme un lecteur d'écran les
 * annonce : un test qui casse sur un renommage signale aussi un libellé changé
 * pour l'utilisateur.
 */

const URL_COURSE = /\/races\/R\d+C\d+-\d{4}-\d{2}-\d{2}$/;

test("accueil → course → onglets du tableau des partants", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Programme PMU" })).toBeVisible();

  await page.getByRole("link", { name: "Analyse complète" }).first().click();
  await expect(page).toHaveURL(URL_COURSE);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  const onglets = page.getByRole("tablist", { name: "Lectures du tableau" });
  const panneau = page.getByRole("tabpanel");

  const classement = onglets.getByRole("tab", { name: "Classement IA" });
  await expect(classement).toHaveAttribute("aria-selected", "true");
  await expect(panneau.getByRole("table")).toBeVisible();

  for (const nom of ["IA × Marché", "MVT & argent", "Classement IA"]) {
    const onglet = onglets.getByRole("tab", { name: nom });
    await onglet.click();
    await expect(onglet).toHaveAttribute("aria-selected", "true");
    // Le panneau est relié à l'onglet actif et le tableau reste rendu.
    await expect(panneau).toHaveAttribute("aria-labelledby", (await onglet.getAttribute("id"))!);
    await expect(panneau.getByRole("table")).toBeVisible();
    await expect(panneau.getByRole("row").nth(1)).toBeVisible();
  }
});

test("/pronostics liste les courses du jour avec un lien vers leur analyse", async ({ page }) => {
  await page.goto("/pronostics");
  await expect(page.getByRole("heading", { level: 1, name: "Pronostics PMU du jour" })).toBeVisible();
  await expect(page.getByRole("article").first()).toBeVisible();

  const analyse = page.getByRole("link", { name: /^Analyse de la course R\d+C\d+$/ }).first();
  await expect(analyse).toHaveAttribute("href", URL_COURSE);
  await analyse.click();
  await expect(page).toHaveURL(URL_COURSE);
});

for (const chemin of ["/methode", "/track-record", "/lexique", "/nouveautes", "/etat"]) {
  test(`${chemin} s'affiche avec un titre de niveau 1`, async ({ page }) => {
    const reponse = await page.goto(chemin);
    expect(reponse?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

test("/etat annonce honnêtement le mode démonstration", async ({ page }) => {
  await page.goto("/etat");
  await expect(page.getByRole("heading", { level: 1, name: "État du service" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Mode démonstration" })).toBeVisible();
});

test("le pied de page mène aux nouveautés et à l'état du service", async ({ page }) => {
  await page.goto("/");
  const pied = page.getByRole("contentinfo");
  await expect(pied.getByRole("link", { name: "Nouveautés" })).toHaveAttribute("href", "/nouveautes");
  await expect(pied.getByRole("link", { name: "État du service" })).toHaveAttribute("href", "/etat");
});

test("le bouton d'alertes push s'affiche sans erreur, sans accorder de permission", async ({ page }) => {
  const erreurs: string[] = [];
  page.on("pageerror", (erreur) => erreurs.push(erreur.message));

  // Un cheval suivi suffit à afficher le panneau « Mes chevaux suivis » et son
  // bouton d'alertes ; la liste vit dans le localStorage du navigateur.
  await page.addInitScript(() => {
    window.localStorage.setItem("pt-chevaux-suivis", JSON.stringify([{ id: "h-1", name: "Helios Prime" }]));
  });
  await page.goto("/");

  const panneau = page.getByRole("region", { name: "Mes chevaux suivis" });
  await expect(panneau).toBeVisible();
  // L'état dépend du navigateur : Chromium headless répond « denied » sans
  // qu'on lui demande rien, un Chromium graphique « default » (bouton actif).
  // Le test vérifie que le composant a quitté l'état d'attente pour l'un de
  // ses états stables, sans jamais cliquer : l'activation demanderait la
  // permission de notification.
  const etatStable = panneau
    .getByRole("button", { name: "Me prévenir avant le départ" })
    .and(page.locator(":enabled"))
    .or(panneau.getByText(/Notifications bloquées|ne gère pas les notifications|Sur iPhone et iPad|Alertes actives/));
  await expect(etatStable.first()).toBeVisible();
  expect(erreurs).toEqual([]);
});
