import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  // Copies de travail des agents, rapports de tests et de Lighthouse : jamais
  // du code source du site.
  {
    ignores: [".claude/**", "playwright-report/**", "test-results/**", ".lighthouseci/**", ".lighthouseci-reports/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
