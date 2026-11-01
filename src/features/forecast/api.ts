/**
 * Accès aux prévisions pour un lieu déjà sélectionné.
 * L’API reçoit les coordonnées géographiques ; le nom de la ville reste une information de présentation.
 */

import { getJson } from "../../shared/api/http";
import type { Location } from "../locations/types";
import type { Forecast } from "./types";

/**
 * Récupère les créneaux et les notes des quatre activités pour les coordonnées du lieu.
 * Le contrat Forecast contient aussi le fuseau et les informations de fraîcheur nécessaires à l’écran.
 * Cette fonction ne mémorise pas les réponses : useForecast gère leur conservation et leur invalidation.
 */
export function getForecast(location: Location): Promise<Forecast> {
  const params = new URLSearchParams({
    latitude: location.latitude.toString(),
    longitude: location.longitude.toString(),
  });
  return getJson<Forecast>(`/forecast?${params}`);
}
