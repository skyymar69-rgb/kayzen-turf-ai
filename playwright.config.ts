import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout (dossier e2e/, hors du glob de `npm test`).
 *
 * Ils tournent contre le build de production, pas le serveur de développement :
 * c'est ce build que Vercel sert, avec son rendu statique et son ISR. Sans
 * DATABASE_URL, le site rend le mode démonstration (une course du jour,
 * R1C3, src/lib/mock-data.ts) : les tests ne touchent à aucune base.
 *
 * En local, un serveur déjà lancé sur le port 3100 (`npm run start`) est
 * réutilisé ; en CI, le build est toujours refait. E2E_PORT choisit un autre
 * port quand 3100 est pris par un autre projet.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  // Une reprise en CI absorbe un aléa réseau ou de démarrage ; en local, un
  // échec doit se voir du premier coup.
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "fr-FR",
    timezoneId: "Europe/Paris",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Équivaut à `npm run build && npm run start`, le port en paramètre.
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    // Le build de production prend une à deux minutes sur un runner GitHub.
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
