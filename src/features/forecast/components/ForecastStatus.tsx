/**
 * Présentations du premier chargement et de son erreur récupérable.
 * Ces états appartiennent au parcours d’entrée ; une actualisation échouée garde les données visibles
 * et est signalée dans ForecastDashboard à partir de leur data_state.
 */

import { locationLabel } from "../../locations/lib/locationLabel";
import type { Location } from "../../locations/types";
import "./ForecastStatus.css";

/**
 * Le lieu est conservé après un échec pour identifier la demande et pouvoir la retenter directement.
 */
type ForecastStatusProps = {
  loading: boolean;
  error: string | null;
  location: Location | null;
  onRetry: (location: Location) => void;
};

/**
 * Annonce poliment le chargement et utilise une alerte pour l’erreur initiale.
 * Le bouton Réessayer renvoie le lieu déjà sélectionné au parent sans demander une nouvelle recherche.
 * Sans lieu ou sans état à présenter, le fragment ne produit aucun panneau visible.
 */
export function ForecastStatus({
  loading: loadingForecast,
  error: forecastError,
  location: selectedLocation,
  onRetry,
}: ForecastStatusProps) {
  return (
    <>
      {loadingForecast && selectedLocation && (
        <section className="forecast-state" aria-live="polite" aria-busy="true">
          <span className="forecast-state__spinner" aria-hidden="true" />
          <p className="eyebrow">{locationLabel(selectedLocation)}</p>
          <h2>Chargement des prévisions pour {selectedLocation.name}…</h2>
        </section>
      )}

      {!loadingForecast && forecastError && selectedLocation && (
        <section className="forecast-state forecast-state--error" role="alert">
          <p className="eyebrow">{locationLabel(selectedLocation)}</p>
          <h2>Impossible de charger les prévisions</h2>
          <p>{forecastError}</p>
          <button type="button" onClick={() => onRetry(selectedLocation)}>
            Réessayer
          </button>
        </section>
      )}
    </>
  );
}
