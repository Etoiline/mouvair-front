/**
 * Correspondances de présentation des statuts de note renvoyés par le backend.
 * Ces tables gardent les textes et les classes cohérents entre la carte de synthèse et le graphique.
 * Le typage Record impose une entrée pour chaque valeur du contrat ScoreStatus.
 */

import type { ScoreStatus } from "../types";

/**
 * Phrases complètes destinées aux détails et aux libellés accessibles du graphique.
 */
export const STATUS_LABELS: Record<ScoreStatus, string> = {
  favorable: "Conditions favorables",
  correct: "Conditions correctes",
  mitigé: "Conditions mitigées",
  défavorable: "Conditions défavorables",
  "très défavorable": "Conditions très défavorables",
  incomplet: "Données incomplètes",
};

/**
 * Suffixes CSS sans accents ni espaces. Ils servent uniquement à choisir la présentation
 * visuelle d’un statut déjà connu, et ne doivent pas contenir de logique de calcul de note.
 */
export const STATUS_TONES: Record<ScoreStatus, string> = {
  favorable: "favorable",
  correct: "correct",
  mitigé: "mitige",
  défavorable: "defavorable",
  "très défavorable": "tres-defavorable",
  incomplet: "incomplet",
};
