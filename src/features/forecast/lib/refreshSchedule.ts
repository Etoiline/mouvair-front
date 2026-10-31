/**
 * Décisions temporelles pures utilisées par useForecast.
 * Les fonctions retournent un délai ou une décision, sans créer de timer ni lire document.
 * Les instants numériques sont exprimés en millisecondes, comme Date.now(), pour permettre les tests.
 */

import type { ForecastDataState } from "../types";

/**
 * Délai entre deux contrôles locaux ; un échec compte aussi comme un contrôle pour espacer les tentatives.
 */
export const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
/**
 * Marge d’une seconde après le début du créneau afin de vérifier les données une fois la limite franchie.
 */
const HOUR_BOUNDARY_DELAY_MS = 1000;

/**
 * Calcule le temps restant depuis le dernier contrôle effectué, sans repartir du dernier rendu React.
 * Un contrôle déjà dû retourne 0 ; aucun délai négatif n’est transmis au navigateur.
 */
export function periodicRefreshDelay(lastCheckAt: number, now: number): number {
  return Math.max(lastCheckAt + REFRESH_INTERVAL_MS - now, 0);
}

/**
 * Planifie le contrôle au début du premier créneau de la réponse, avec la marge prévue.
 * null signifie qu’aucun contrôle de frontière n’est nécessaire ou que l’horodatage est inexploitable ;
 * 0 demande un rattrapage immédiat lorsqu’une frontière passée n’a pas encore été contrôlée.
 * Le dernier contrôle empêche une boucle de requêtes si l’API conserve un créneau déjà commencé.
 */
export function boundaryRefreshDelay(
  firstStartValue: string,
  lastCheckAt: number | null,
  now: number,
): number | null {
  const firstStart = Date.parse(firstStartValue);
  if (!Number.isFinite(firstStart)) return null;
  if (firstStart < now) {
    return lastCheckAt === null || lastCheckAt <= firstStart ? 0 : null;
  }
  return firstStart + HOUR_BOUNDARY_DELAY_MS - now;
}

/**
 * Décide si le retour sur un onglet visible nécessite de rattraper une vérification.
 * Trois motifs indépendants suffisent : intervalle de contrôle dépassé, début de créneau manqué,
 * ou données marquées fraîches dont la durée de réutilisation est écoulée.
 * Une date de récupération illisible invalide aussi la réutilisation d’un cache supposé frais.
 */
export function shouldRefreshWhenVisible(
  firstStartValue: string,
  generatedAtValue: string,
  dataState: ForecastDataState,
  lastCheckAt: number | null,
  now: number,
): boolean {
  const firstStart = Date.parse(firstStartValue);
  const retrievedAt = Date.parse(generatedAtValue);
  const checkIsDue = lastCheckAt === null || now - lastCheckAt >= REFRESH_INTERVAL_MS;
  const boundaryIsDue =
    Number.isFinite(firstStart) &&
    firstStart < now &&
    (lastCheckAt === null || lastCheckAt <= firstStart);
  const freshCacheExpired =
    dataState === "fresh" &&
    (!Number.isFinite(retrievedAt) || now - retrievedAt > REFRESH_INTERVAL_MS);
  return checkIsDue || boundaryIsDue || freshCacheExpired;
}
