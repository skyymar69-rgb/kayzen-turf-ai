/**
 * Génère les icônes du site à partir d'une source SVG unique.
 *
 * `public/manifest.json` réclamait /icon-192.png et /icon-512.png, et le JSON-LD
 * du layout déclarait un logo d'organisation sur /logo.png : aucun de ces trois
 * fichiers n'existait. Résultat : PWA non installable, logo `Organization`
 * invalide côté Google, et pas la moindre favicon.
 *
 * Le script est idempotent — `node scripts/generate-icons.mjs` régénère tout.
 *
 * La variante « maskable » réserve la zone de sécurité Android (safe zone de
 * 80 %) : sans elle, le rognage circulaire d'Android ampute le monogramme.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");

const VERT_FONCE = "#0c2318";
const VERT_CTA = "#1eb854";
const ENCRE = "#0c1a10";

/**
 * @param {object} options
 * @param {number} options.taille        côté de l'image, en pixels
 * @param {number} options.echelleMotif  proportion occupée par le monogramme
 * @param {number} options.rayon         rayon des coins, en proportion du côté
 * @param {boolean} options.fondPlein    true pour un aplat CTA (icône maskable)
 */
function sourceSvg({ taille, echelleMotif, rayon, fondPlein }) {
  const motif = taille * echelleMotif;
  const decalage = (taille - motif) / 2;
  const fond = fondPlein ? VERT_CTA : VERT_FONCE;
  const texte = fondPlein ? ENCRE : VERT_CTA;

  return Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}">
  <rect width="${taille}" height="${taille}" rx="${taille * rayon}" fill="${fond}"/>
  <g transform="translate(${decalage} ${decalage})">
    <text
      x="${motif / 2}" y="${motif / 2}"
      font-family="Helvetica, Arial, sans-serif"
      font-size="${motif * 0.5}" font-weight="700"
      letter-spacing="${motif * -0.015}"
      fill="${texte}" text-anchor="middle" dominant-baseline="central"
    >KZ</text>
  </g>
</svg>`);
}

/** @type {Array<{chemin: string, taille: number, echelleMotif: number, rayon: number, fondPlein: boolean}>} */
const cibles = [
  // Favicon servie par Next depuis src/app (convention `icon.png`).
  { chemin: "src/app/icon.png", taille: 64, echelleMotif: 1, rayon: 0.18, fondPlein: false },
  // iOS ne gère pas la transparence : fond plein, coins gérés par le système.
  { chemin: "src/app/apple-icon.png", taille: 180, echelleMotif: 1, rayon: 0, fondPlein: false },
  // Icônes déclarées par le manifeste.
  { chemin: "public/icon-192.png", taille: 192, echelleMotif: 1, rayon: 0.2, fondPlein: false },
  { chemin: "public/icon-512.png", taille: 512, echelleMotif: 1, rayon: 0.2, fondPlein: false },
  // Maskable : le motif tient dans les 80 % centraux, le reste est du fond.
  { chemin: "public/icon-maskable-512.png", taille: 512, echelleMotif: 0.8, rayon: 0, fondPlein: true },
  // Logo `Organization` du JSON-LD : Google le veut carré, >= 112 px.
  { chemin: "public/logo.png", taille: 512, echelleMotif: 1, rayon: 0.2, fondPlein: false },
];

for (const { chemin, ...options } of cibles) {
  const destination = join(racine, chemin);
  await mkdir(dirname(destination), { recursive: true });
  const png = await sharp(sourceSvg(options)).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(destination, png);
  console.log(`${chemin.padEnd(32)} ${options.taille}×${options.taille}  ${(png.length / 1024).toFixed(1)} ko`);
}
