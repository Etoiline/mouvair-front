/**
 * Libellé de lieu commun à l’état de chargement et au tableau de bord.
 * Cette fonction reste indépendante de React afin que les deux vues utilisent la même présentation.
 */

import type { Location } from "../types";

/**
 * Assemble la ville, la région et le pays sans séparateur vide lorsque l’API omet un complément.
 * Le nom de la ville reste en premier ; les coordonnées ne sont pas utilisées comme libellé de secours.
 */
export function locationLabel(location: Location): string {
  return [location.name, location.admin1, location.country].filter(Boolean).join(", ");
}
