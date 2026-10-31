/**
 * Accès au point d’entrée de recherche des lieux.
 * La temporisation et l’affichage des résultats appartiennent au hook, pas à cette fonction réseau.
 */

import { getJson } from "../../shared/api/http";
import type { Location } from "./types";

/**
 * Encode la saisie dans le paramètre q pour préserver les accents, espaces et caractères réservés.
 * Le signal permet au hook d’interrompre la requête dès que la saisie devient obsolète.
 * Un tableau vide est une recherche réussie sans résultat ; le hook choisit alors le message à afficher.
 */
export function searchLocations(query: string, signal?: AbortSignal): Promise<Location[]> {
  const params = new URLSearchParams({ q: query });
  return getJson<Location[]>(`/locations?${params}`, signal);
}
