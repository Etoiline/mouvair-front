/**
 * Vue de la recherche de ville, pilotée par le contrôleur useLocationSearch.
 * Le formulaire autorise le déclenchement immédiat tandis que le hook gère la recherche automatique.
 * Le menu est superposé par le CSS et garde ses résultats visibles mais inactifs pendant une mise à jour.
 */

import { LOCATION_SEARCH_MIN_LENGTH } from "../hooks/useLocationSearch";
import type { LocationSearchController } from "../hooks/useLocationSearch";
import type { Location } from "../types";
import "./LocationSearch.css";

/**
 * Le contrôleur porte l’état de recherche ; onSelect ouvre le parcours métier du parent.
 * Cette séparation permet de choisir un lieu sans importer le hook de prévisions dans cette vue.
 */
type LocationSearchProps = {
  search: LocationSearchController;
  onSelect: (location: Location) => void;
};

/**
 * Rend un champ contrôlé, les résultats et l’erreur de recherche sans masquer le formulaire.
 * La sélection ferme d’abord le menu et met le champ à jour, puis transmet le lieu au parent.
 * aria-busy décrit la mise à jour de la liste et le statut de chargement en annonce l’avancement.
 */
export function LocationSearch({ search, onSelect }: LocationSearchProps) {
  const {
    query,
    setQuery,
    locations,
    searchingLocations,
    locationResultsPending,
    searchError,
    handleSearch,
    chooseLocation,
  } = search;

  return (
    <div className="search-area">
      <form className="search" onSubmit={handleSearch}>
        <label htmlFor="city">Votre ville</label>
        <div className="search__row">
          <input
            id="city"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Lyon, Nantes, Annecy…"
            minLength={LOCATION_SEARCH_MIN_LENGTH}
          />
          <button
            type="submit"
            disabled={searchingLocations || query.trim().length < LOCATION_SEARCH_MIN_LENGTH}
          >
            {searchingLocations ? "Recherche…" : "Voir les conditions"}
          </button>
        </div>
      </form>

      {(locations.length > 0 || locationResultsPending) && (
        <div
          className={`location-results${
            locationResultsPending ? " location-results--loading" : ""
          }`}
          aria-label="Résultats de recherche"
          aria-busy={locationResultsPending}
        >
          {locations.map((location) => (
            <button
              key={location.id}
              onClick={() => {
                chooseLocation(location);
                onSelect(location);
              }}
              disabled={locationResultsPending}
            >
              <strong>{location.name}</strong>
              <span>{[location.admin1, location.country].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
          {locationResultsPending && (
            <div className="location-results__loading" role="status">
              <span className="location-results__spinner" aria-hidden="true" />
              Mise à jour des résultats…
            </div>
          )}
        </div>
      )}
      {searchError && <p className="error">{searchError}</p>}
    </div>
  );
}
