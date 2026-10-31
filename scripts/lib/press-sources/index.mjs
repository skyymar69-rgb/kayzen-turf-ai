/**
 * Registre des sources presse, dans l'ordre d'exécution (séquentiel).
 * Chaque module exporte `SOURCE` et `collect({ date, races, http })`.
 */

import * as canalturf from "./canalturf.mjs";
import * as geny from "./geny.mjs";
import * as parisTurf from "./paris-turf.mjs";
import * as pmuPresse from "./pmu-presse.mjs";
import * as turfomania from "./turfomania.mjs";
import * as zeturf from "./zeturf.mjs";

export const PRESS_SOURCES = [pmuPresse, geny, zeturf, canalturf, turfomania, parisTurf];
