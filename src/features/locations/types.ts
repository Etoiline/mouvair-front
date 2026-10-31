/**
 * Contrat d’un lieu proposé par la recherche de villes.
 * Les noms de propriétés sont conservés tels qu’ils sont reçus de l’API pour éviter une conversion
 * implicite entre la recherche, les libellés et la requête de prévisions.
 */

/**
 * L’identifiant sert de clé stable pour les résultats, tandis que latitude et longitude permettent
 * la requête météo. Le pays, la région administrative et le fuseau peuvent manquer indépendamment.
 * Le fuseau utilisé pour présenter les créneaux est celui de Forecast, disponible après chargement.
 */
export type Location = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
  /**
   * Région administrative utilisée avec le pays pour distinguer les villes homonymes.
   */
  admin1: string | null;
  timezone: string | null;
};
