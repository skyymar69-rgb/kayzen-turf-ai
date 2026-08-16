/**
 * Injection sûre d'un bloc JSON-LD.
 *
 * `JSON.stringify` n'échappe ni `<` ni `>` : un nom de course ou de cheval
 * contenant `</script><script>…` — donnée importée depuis l'API PMU, donc hors
 * de notre contrôle — refermait la balise et exécutait le script suivant. C'est
 * la faille XSS classique des données structurées (OWASP A03:2021, Injection).
 *
 * Chaque caractère sensible est remplacé par son échappement Unicode JSON : le
 * chevron ouvrant devient la séquence de six caractères u003c, qui se relit
 * `<` côté parseur mais ne peut plus refermer une balise HTML. U+2028 et
 * U+2029 sont valides en JSON et interdits en littéral JavaScript ; les
 * échapper évite qu'un consommateur strict rejette le bloc entier.
 *
 * La séquence est calculée depuis le code du caractère plutôt qu'écrite dans
 * une table de correspondance : cela évite d'avoir à manipuler des barres
 * obliques inverses littérales, source d'erreurs silencieuses — une barre
 * perdue et l'échappement redevient le caractère qu'il devait neutraliser.
 */
const CARACTERES_SENSIBLES = /[<>&\u2028\u2029]/g;

/** Code 92 = barre oblique inverse. */
const BARRE_OBLIQUE_INVERSE = String.fromCharCode(92);

function echapper(caractere: string): string {
  const code = caractere.charCodeAt(0).toString(16).padStart(4, "0");
  return `${BARRE_OBLIQUE_INVERSE}u${code}`;
}

export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(CARACTERES_SENSIBLES, echapper);

  return (
    <script
      type="application/ld+json"
      // Contenu produit par JSON.stringify puis échappé ci-dessus : aucune
      // portion ne peut refermer la balise.
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}
