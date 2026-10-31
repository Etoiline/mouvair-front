/**
 * Sélection des créneaux à mettre en avant pour l’activité choisie.
 * Ces fonctions lisent les notes déjà calculées par le backend ; elles ne modifient ni les notes
 * ni l’ordre du tableau reçu et ne décident pas de la fraîcheur permettant une recommandation.
 */

import type { ForecastHour, SportId } from "../types";

/**
 * Retourne le premier créneau portant la meilleure note globale disponible.
 * Les notes nulles sont ignorées ; une note égale à 0 reste une candidate valide.
 * Un tableau vide ou entièrement incomplet retourne null, sans proposer de faux meilleur créneau.
 */
export function findBestHour(hours: ForecastHour[], sport: SportId): ForecastHour | null {
  return hours.reduce<ForecastHour | null>((best, hour) => {
    const score = hour.scores[sport].overall.score;
    if (score === null) return best;

    const bestScore = best?.scores[sport].overall.score;
    // L’ordre chronologique fourni par l’API départage les égalités en conservant le premier.
    return bestScore === null || bestScore === undefined || score > bestScore ? hour : best;
  }, null);
}

/**
 * Détecte les deux statuts défavorables pour accompagner une meilleure option qui reste mauvaise.
 * La qualification de l’API est utilisée directement, sans recréer un seuil numérique côté frontend.
 */
export function hasUnfavorableOverall(hour: ForecastHour, sport: SportId): boolean {
  const status = hour.scores[sport].overall.status;
  return status === "défavorable" || status === "très défavorable";
}
