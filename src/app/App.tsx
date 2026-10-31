/**
 * Assemblage du parcours principal de Mouv’Air.
 * App relie les fonctionnalités de recherche et de prévisions, puis transmet leur état aux vues.
 * Il ne calcule ni les notes ni les horaires et ne lance aucune requête en dehors des actions des hooks.
 */

import { ForecastDashboard } from "../features/forecast/components/ForecastDashboard";
import { ForecastStatus } from "../features/forecast/components/ForecastStatus";
import { useForecast } from "../features/forecast/hooks/useForecast";
import { LocationSearch } from "../features/locations/components/LocationSearch";
import { useLocationSearch } from "../features/locations/hooks/useLocationSearch";
import { AppLayout } from "./AppLayout";

/**
 * Compose la recherche, les états de premier chargement et le tableau de bord dans le cadre commun.
 * ForecastDashboard reste présent dans l’arbre React même lorsqu’il n’a rien à afficher : ses préférences
 * d’activité et de panneau survivent ainsi à une nouvelle recherche de ville.
 */
export default function App() {
  const {
    forecast,
    selectedLocation,
    loadingForecast,
    refreshing,
    forecastError,
    loadForecast,
    refreshForecast,
    resetForecast,
  } = useForecast();
  /**
   * Le démarrage effectif d’une recherche efface et invalide les anciennes prévisions.
   * Ce branchement est volontairement fait ici pour garder la recherche indépendante des prévisions.
   */
  const search = useLocationSearch(resetForecast);

  return (
    <AppLayout
      search={<LocationSearch search={search} onSelect={(location) => void loadForecast(location)} />}
    >
      <ForecastStatus
        loading={loadingForecast}
        error={forecastError}
        location={selectedLocation}
        onRetry={(location) => void loadForecast(location)}
      />
      <ForecastDashboard
        forecast={forecast}
        location={selectedLocation}
        refreshing={refreshing}
        onRefresh={() => void refreshForecast()}
      />
      {!forecast && !search.searchingLocations && !loadingForecast && !forecastError && (
        <section className="empty-state">
          <span>01</span>
          <p>Recherchez une ville pour comparer les quatre activités sur les prochaines 24 heures.</p>
        </section>
      )}
    </AppLayout>
  );
}
