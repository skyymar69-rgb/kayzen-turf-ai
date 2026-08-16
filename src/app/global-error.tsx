"use client";

import { useEffect } from "react";

/**
 * Dernier filet : une exception levée dans le layout racine lui-même échappe à
 * `error.tsx`, qui vit à l'intérieur de ce layout. `global-error` remplace donc
 * `<html>` et `<body>`, et ne peut réutiliser ni l'en-tête, ni le pied de page,
 * ni les jetons de thème — ses styles sont écrits en ligne à dessein.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erreur fatale", error.digest ?? "(sans digest)", error);
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          background: "#f5f6f5",
          color: "#111827",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <main style={{ maxWidth: "34rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.6rem", margin: "0 0 0.75rem" }}>
            Le service est momentanément indisponible
          </h1>
          <p style={{ lineHeight: 1.7, color: "#4b5563", margin: "0 0 1.5rem" }}>
            Une erreur inattendue a interrompu le chargement. Nos équipes en sont informées.
          </p>
          {error.digest && (
            <p style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#4b5563" }}>
              Référence incident : {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            type="button"
            style={{
              marginTop: "1rem",
              minHeight: "2.75rem",
              padding: "0 1.5rem",
              borderRadius: "0.75rem",
              border: "none",
              background: "#1eb854",
              color: "#111827",
              fontWeight: 700,
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            Réessayer
          </button>
        </main>
      </body>
    </html>
  );
}
