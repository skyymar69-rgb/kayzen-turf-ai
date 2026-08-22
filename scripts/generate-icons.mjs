/**
 * Dérive toute l'identité visuelle du site d'un seul fichier source :
 * `assets/brand/pronoturf-source.png`, le logo PronoTurf tel que livré.
 *
 * La source est un rendu de présentation : 2816 × 1536, opaque, logo posé sur un
 * mur sombre texturé. Elle n'est donc utilisable ni en en-tête (le thème clair
 * afficherait un rectangle noir) ni en favicon (le lettrage disparaît sous
 * 64 px). Ce script en extrait deux briques réutilisables — le lockup complet et
 * la marque seule, tous deux détourés — puis en décline les icônes.
 *
 * Détourage. Le fond et le logo se séparent proprement sur deux axes mesurés sur
 * la source : le fond est désaturé et sombre (S ≤ 12, V ≤ 50), les aplats du
 * logo sont saturés (S ≥ 60) et le lettrage est blanc pur (V = 255). L'alpha est
 * la combinaison continue des deux critères, ce qui conserve l'antialiasing des
 * contours au lieu de le hacher. Les pixels de bord sont ensuite dépré-multipliés
 * du fond d'origine : sans cette étape, un liseré sombre cerne le logo dès qu'on
 * le pose sur un fond clair.
 *
 * Le script est idempotent : `npm run brand:icons` régénère tout.
 *
 *   node scripts/generate-icons.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(racine, "assets/brand/pronoturf-source.png");

/** Fond des tuiles d'icône — `theme_color` du manifeste, pour que la couleur de
 *  la barre système d'Android prolonge l'icône au lieu de trancher avec. */
const FOND_TUILE = { r: 0x0c, g: 0x23, b: 0x18, alpha: 1 };

/** Fond de la source, estimé au voisinage du logo. Sert au dépré-multipliage. */
const FOND_SOURCE = [22, 25, 30];

// ── Détourage ───────────────────────────────────────────────────────────────

/**
 * Alpha continu, sur deux critères mesurés sur la source : les aplats du logo
 * sont saturés (S ≥ 60) et le lettrage est blanc pur (V = 255), alors que le mur
 * reste désaturé (S ≤ 25, bruit de texture compris) et sombre (V ≤ 116, vignette
 * de l'angle haut-droit comprise). Les deux seuils passent au-dessus du maximum
 * du fond : un seuil plus bas retenait 10 % du mur comme s'il était du logo.
 */
function opacite(r, g, b) {
  const max = Math.max(r, g, b);
  const saturation = max - Math.min(r, g, b);
  const parSaturation = (saturation - 30) / 25;
  const parLuminosite = (max - 150) / 60;
  return Math.max(0, Math.min(1, Math.max(parSaturation, parLuminosite)));
}

/**
 * Rend opaques les pixels enfermés dans l'illustration.
 *
 * Les ombres les plus sombres du cheval (un bleu nuit presque noir) tombent sous
 * le seuil de saturation et se détouraient en trous. On ne peut pas les
 * rattraper par le seuil sans reprendre le mur avec ; on les distingue par la
 * topologie : le fond est le seul vide qui touche le bord. Tout vide qu'un
 * remplissage par diffusion depuis le bord n'atteint pas est un trou intérieur,
 * et redevient opaque.
 *
 * L'opération est bornée à la bande du cheval. Appliquée au lettrage, elle
 * boucherait les contre-formes des lettres : les « O » de PRONOTURF ressortaient
 * en pastilles pleines, et les panses du P et du R en aplats sombres.
 */
function boucherTrous(alpha, width, { haut, bas }) {
  const exterieur = new Uint8Array(width * (bas - haut + 1));
  const pile = [];

  const empiler = (x, y) => {
    const index = (y - haut) * width + x;
    if (exterieur[index] || alpha[y * width + x] > 128) return;
    exterieur[index] = 1;
    pile.push(index);
  };

  for (let x = 0; x < width; x += 1) {
    empiler(x, haut);
    empiler(x, bas);
  }
  for (let y = haut; y <= bas; y += 1) {
    empiler(0, y);
    empiler(width - 1, y);
  }

  while (pile.length > 0) {
    const index = pile.pop();
    const x = index % width;
    const y = (index - x) / width + haut;
    if (x > 0) empiler(x - 1, y);
    if (x < width - 1) empiler(x + 1, y);
    if (y > haut) empiler(x, y - 1);
    if (y < bas) empiler(x, y + 1);
  }

  for (let index = 0; index < exterieur.length; index += 1) {
    if (!exterieur[index]) alpha[haut * width + index] = 255;
  }
}

async function lireSource() {
  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const alpha = new Uint8Array(width * height);

  for (let index = 0, pixel = 0; index < data.length; index += channels, pixel += 1) {
    alpha[pixel] = Math.round(opacite(data[index], data[index + 1], data[index + 2]) * 255);
  }

  return { data, alpha, width, height, channels };
}

/** Assemble le RGBA final une fois l'alpha arrêté. */
function composer({ data, alpha, width, height, channels }) {
  const sortie = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < alpha.length; pixel += 1) {
    const source = pixel * channels;
    const destination = pixel * 4;
    const opacite255 = alpha[pixel];

    // Dépré-multipliage : un pixel de contour est un mélange (couleur du logo,
    // fond sombre). Le rendre tel quel sur un fond clair laisserait le fond
    // d'origine transparaître en liseré ; on retire sa contribution.
    for (let canal = 0; canal < 3; canal += 1) {
      const brut = data[source + canal];
      const restitue =
        opacite255 > 1 ? (brut - (1 - opacite255 / 255) * FOND_SOURCE[canal]) / (opacite255 / 255) : 0;
      sortie[destination + canal] = Math.max(0, Math.min(255, Math.round(restitue)));
    }
    sortie[destination + 3] = opacite255;
  }

  return { buffer: sortie, width, height };
}

/**
 * Sépare la marque (cheval + flèche) du lettrage.
 *
 * Le lockup est un empilement vertical : les deux blocs sont séparés par une
 * bande de lignes entièrement transparentes. On cherche la plus large de ces
 * bandes plutôt qu'un ratio en dur, pour que le script survive à une source
 * recadrée différemment.
 */
function separerBlocs({ alpha, width, height }) {
  const plein = new Array(height);
  for (let y = 0; y < height; y += 1) {
    let somme = 0;
    for (let x = 0; x < width; x += 1) somme += alpha[y * width + x];
    plein[y] = somme / (width * 255) > 0.004;
  }

  const premier = plein.indexOf(true);
  const dernier = plein.lastIndexOf(true);

  let meilleurDebut = -1;
  let meilleureLongueur = 0;
  let debut = -1;
  for (let y = premier; y <= dernier; y += 1) {
    if (!plein[y]) {
      if (debut === -1) debut = y;
    } else if (debut !== -1) {
      if (y - debut > meilleureLongueur) {
        meilleureLongueur = y - debut;
        meilleurDebut = debut;
      }
      debut = -1;
    }
  }

  if (meilleurDebut === -1) throw new Error("aucune séparation marque / lettrage trouvée");
  return { hautLockup: premier, basMarque: meilleurDebut, basLockup: dernier };
}

/**
 * Recadre sur les pixels non transparents.
 *
 * Le recadrage est calculé sur le canal alpha plutôt que confié à `trim()` :
 * celui-ci se cale sur la couleur du pixel supérieur gauche, ce qui n'a pas de
 * sens sur une image dont tout le pourtour est déjà transparent.
 */
function recadrer({ buffer, width, height }, { top = 0, bottom = height - 1 } = {}) {
  let minX = width;
  let maxX = -1;
  let minY = bottom;
  let maxY = -1;

  for (let y = top; y <= bottom; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (buffer[(y * width + x) * 4 + 3] < 8) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) throw new Error("zone entièrement transparente");

  return sharp(buffer, { raw: { width, height, channels: 4 } }).extract({
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  });
}

/** Place la marque au centre d'un carré, sur fond plein ou transparent. */
async function tuile(marque, { taille, echelle, rayon = 0, fond = FOND_TUILE }) {
  const motif = await sharp(marque)
    .resize({
      width: Math.round(taille * echelle),
      height: Math.round(taille * echelle),
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  const socle = fond
    ? sharp({ create: { width: taille, height: taille, channels: 4, background: fond } })
    : sharp({ create: { width: taille, height: taille, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });

  let plaque = socle.composite([{ input: motif, gravity: "center" }]);

  if (rayon > 0) {
    const coins = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}">
         <rect width="${taille}" height="${taille}" rx="${Math.round(taille * rayon)}" fill="#fff"/>
       </svg>`,
    );
    plaque = sharp(await plaque.png().toBuffer()).composite([{ input: coins, blend: "dest-in" }]);
  }

  return plaque.png({ compressionLevel: 9 }).toBuffer();
}

// ── ICO ─────────────────────────────────────────────────────────────────────

/**
 * Assemble un .ico multi-résolution. Chaque image est stockée en PNG : le
 * format est accepté par tous les navigateurs depuis Vista, et évite le BMP
 * bottom-up avec masque AND que réclamait l'ancien format.
 */
function assemblerIco(images) {
  const entete = Buffer.alloc(6);
  entete.writeUInt16LE(0, 0); // réservé
  entete.writeUInt16LE(1, 2); // type 1 = icône
  entete.writeUInt16LE(images.length, 4);

  const repertoire = Buffer.alloc(16 * images.length);
  let decalage = entete.length + repertoire.length;

  images.forEach(({ taille, png }, rang) => {
    const base = rang * 16;
    repertoire[base] = taille >= 256 ? 0 : taille; // 0 signifie 256
    repertoire[base + 1] = taille >= 256 ? 0 : taille;
    repertoire[base + 2] = 0; // palette
    repertoire[base + 3] = 0; // réservé
    repertoire.writeUInt16LE(1, base + 4); // plans
    repertoire.writeUInt16LE(32, base + 6); // bits par pixel
    repertoire.writeUInt32LE(png.length, base + 8);
    repertoire.writeUInt32LE(decalage, base + 12);
    decalage += png.length;
  });

  return Buffer.concat([entete, repertoire, ...images.map(({ png }) => png)]);
}

// ── Génération ──────────────────────────────────────────────────────────────

async function ecrire(chemin, contenu) {
  const destination = join(racine, chemin);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contenu);
  const { width, height } = await sharp(contenu).metadata().catch(() => ({}));
  const dimensions = width ? `${width}×${height}`.padEnd(11) : "multi".padEnd(11);
  console.log(`  ${chemin.padEnd(38)} ${dimensions} ${(contenu.length / 1024).toFixed(1)} ko`);
}

const source = await lireSource();
const { hautLockup, basMarque, basLockup } = separerBlocs(source);
boucherTrous(source.alpha, source.width, { haut: hautLockup, bas: basMarque });
const detoure = composer(source);

console.log(`Source  : assets/brand/pronoturf-source.png (${source.width}×${source.height})`);
console.log(`Marque  : lignes ${hautLockup} → ${basMarque}`);
console.log(`Lockup  : lignes ${hautLockup} → ${basLockup}
`);

// Lockup complet, détouré — usage marketing, PDF, partage.
const lockup = recadrer(detoure, { top: hautLockup, bottom: basLockup });

// Marque seule — c'est elle, et non le lockup, qui alimente toutes les icônes :
// le lettrage devient illisible sous 64 px et ne survit pas au masque circulaire
// d'Android.
const marque = await recadrer(detoure, { top: hautLockup, bottom: basMarque }).png().toBuffer();
const { width: LARGEUR_MARQUE, height: HAUTEUR_MARQUE } = await sharp(marque).metadata();

console.log("Briques réutilisables");
await ecrire("public/brand/pronoturf-lockup.png", await lockup.resize({ width: 1600 }).png({ compressionLevel: 9 }).toBuffer());
await ecrire("public/brand/pronoturf-mark.png", await sharp(marque).resize({ width: 1024 }).png({ compressionLevel: 9 }).toBuffer());

/**
 * Glyphe de repli pour 16 px : la flèche ascendante seule.
 *
 * À cette taille, l'illustration complète ne rend plus qu'une tache verte — le
 * cheval y mesure 16 × 9 pixels, cavalier compris. La flèche est le seul élément
 * du logo dont la forme survive, et c'est celle qui porte le message. Dès 32 px
 * la marque entière redevient lisible et reprend la main.
 */
const glypheCompact = await sharp(marque)
  .extract({
    left: 0,
    top: 0,
    width: Math.round(LARGEUR_MARQUE * 0.4),
    height: Math.round(HAUTEUR_MARQUE * 0.5),
  })
  .png()
  .toBuffer();

console.log("\nFavicons");
// Sous 48 px, la marge autour du motif coûte plus cher que la respiration
// qu'elle apporte : le motif est agrandi à 96 % de la tuile.
const petites = await Promise.all(
  [
    { taille: 16, motif: glypheCompact, echelle: 0.92 },
    { taille: 32, motif: marque, echelle: 0.96 },
    { taille: 48, motif: marque, echelle: 0.96 },
  ].map(async ({ taille, motif, echelle }) => ({ taille, png: await tuile(motif, { taille, echelle, rayon: 0 }) })),
);
await ecrire("src/app/favicon.ico", assemblerIco(petites));
for (const { taille, png } of petites) await ecrire(`public/favicon-${taille}x${taille}.png`, png);

// Next sert src/app/icon.png en <link rel="icon">, résolution moderne.
await ecrire("src/app/icon.png", await tuile(marque, { taille: 512, echelle: 0.86, rayon: 0.18 }));

console.log("\niOS");
// iOS ignore la transparence et applique lui-même le masque : fond plein,
// coins carrés, et une marge un peu plus large parce que le système rogne.
await ecrire("src/app/apple-icon.png", await tuile(marque, { taille: 180, echelle: 0.8, rayon: 0 }));
await ecrire("public/apple-touch-icon.png", await tuile(marque, { taille: 180, echelle: 0.8, rayon: 0 }));
// Retina iPad et anciens appareils, servis par les balises du layout.
for (const taille of [152, 167]) {
  await ecrire(`public/apple-touch-icon-${taille}x${taille}.png`, await tuile(marque, { taille, echelle: 0.8, rayon: 0 }));
}

console.log("\nAndroid / PWA");
await ecrire("public/icon-192.png", await tuile(marque, { taille: 192, echelle: 0.86, rayon: 0.2 }));
await ecrire("public/icon-512.png", await tuile(marque, { taille: 512, echelle: 0.86, rayon: 0.2 }));
// Maskable : Android rogne jusqu'à 20 % de chaque bord. Le motif tient dans la
// zone de sécurité, le reste est du fond — sinon le masque ampute le cheval.
await ecrire("public/icon-maskable-512.png", await tuile(marque, { taille: 512, echelle: 0.62, rayon: 0 }));

console.log("\nWindows");
await ecrire("public/mstile-150x150.png", await tuile(marque, { taille: 150, echelle: 0.8, rayon: 0 }));

console.log("\nEmbarque");
// Le PDF et l'image Open Graph sont rendus cote serveur, hors du navigateur :
// ils ne peuvent pas resoudre "/brand/...", et lire public/ au moment de la
// requete dependrait du tracing de fichiers de la plateforme. La marque est
// donc figee en data URI dans un module TypeScript, importe comme n'importe
// quelle constante.
const embarquee = await sharp(marque).resize({ width: 160 }).png({ compressionLevel: 9 }).toBuffer();
const moduleMarque = [
  "/**",
  " * Marque PronoTurf en data URI - GENERE, ne pas modifier a la main.",
  " * Source : assets/brand/pronoturf-source.png, via `npm run brand:icons`.",
  " *",
  " * Destine aux rendus serveur qui ne peuvent pas charger une URL du site :",
  " * le PDF des pronostics et l\'image Open Graph.",
  " */",
  "export const MARQUE_DATA_URI =",
  `  "data:image/png;base64,${embarquee.toString("base64")}";`,
  "",
  "/** Rapport largeur / hauteur de la marque, pour dimensionner sans deformer. */",
  `export const MARQUE_RATIO = ${(LARGEUR_MARQUE / HAUTEUR_MARQUE).toFixed(4)};`,
  "",
].join("\n");
await ecrire("src/lib/brand-mark.ts", Buffer.from(moduleMarque, "utf8"));

console.log("\nRéférencement");
// Logo `Organization` du JSON-LD : Google le veut carré et >= 112 px.
await ecrire("public/logo.png", await tuile(marque, { taille: 512, echelle: 0.86, rayon: 0.2 }));
