/**
 * Présentation française des mesures reçues pour un créneau.
 * Les formateurs sont partagés entre les rendus pour conserver la même précision et éviter
 * de reconstruire un Intl.NumberFormat à chaque valeur affichée.
 */

/**
 * Précision commune aux mesures météo et à l’AQI brut : au plus une décimale, sans compléter avec des zéros.
 */
export const DECIMAL_FORMATTER = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});
/**
 * Les concentrations de pollen gardent jusqu’à deux décimales pour rendre visibles les petites valeurs.
 */
const POLLEN_VALUE_FORMATTER = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

/**
 * Ajoute l’unité uniquement à une mesure disponible ; une donnée absente reçoit un libellé explicite.
 * Le test porte sur null et undefined afin de conserver les valeurs 0, notamment les précipitations nulles.
 */
export function formatWeatherValue(value: number | null | undefined, unit: string): string {
  return value === null || value === undefined
    ? "Indisponible"
    : `${DECIMAL_FORMATTER.format(value)} ${unit}`;
}

/**
 * Affiche les traces positives inférieures à 0,01 comme « < 0,01 » pour éviter un arrondi trompeur à 0.
 * La valeur réellement égale à zéro reste affichée comme telle ; l’appelant traite séparément null.
 */
export function formatPollenValue(value: number): string {
  if (value > 0 && value < 0.01) return "< 0,01";
  return POLLEN_VALUE_FORMATTER.format(value);
}
