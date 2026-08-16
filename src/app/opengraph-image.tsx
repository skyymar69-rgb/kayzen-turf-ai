import { ImageResponse } from "next/og";

/**
 * Aucune image de partage n'existait : un lien collé sur WhatsApp, X ou LinkedIn
 * s'affichait en carte texte nue. Next sert ce rendu pour `og:image` et
 * `twitter:image` sur toutes les pages qui n'en déclarent pas de plus précise.
 */
export const alt = "Kayzen Turf AI — pronostics PMU assistés par IA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0c2318 0%, #123a26 55%, #0a1c12 100%)",
          color: "#e2ede5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#1eb854",
              color: "#0c1a10",
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            K
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#7fd9a2",
            }}
          >
            Kayzen Turf AI
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Satori ne gère pas <br /> et exige un display explicite dès qu'un
              élément a plusieurs enfants : chaque ligne est sa propre boîte. */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -1,
            }}
          >
            <div style={{ display: "flex" }}>Pronostics PMU</div>
            <div style={{ display: "flex" }}>assistés par intelligence artificielle</div>
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.4, color: "#a7c9b4", maxWidth: 900 }}>
            Probabilités calibrées, value bets et tickets optimisés — hier, aujourd&apos;hui, demain.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 24 }}>
          <div style={{ display: "flex", gap: 14 }}>
            {["Plat", "Trot", "Obstacle"].map((discipline) => (
              <div
                key={discipline}
                style={{
                  display: "flex",
                  padding: "8px 20px",
                  borderRadius: 999,
                  border: "1px solid rgba(226,237,229,0.24)",
                  color: "#c8e2d3",
                }}
              >
                {discipline}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", color: "#7fd9a2", fontWeight: 700 }}>
            Aide à la décision — jouer comporte des risques. 18+
          </div>
        </div>
      </div>
    ),
    size,
  );
}
