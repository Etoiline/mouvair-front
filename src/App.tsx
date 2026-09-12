import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";

import { getForecast, searchLocations } from "./api";
import {
  formatLocalInterval,
  formatLocalTime,
  formatSlot,
  formatTimeZoneLabel,
  groupByLocalDate,
} from "./dateTime";
import { findBestHour, hasUnfavorableOverall } from "./forecastRanking";
import {
  boundaryRefreshDelay,
  periodicRefreshDelay,
  shouldRefreshWhenVisible,
} from "./refreshSchedule";
import type {
  AirQualityCategory,
  Forecast,
  Location,
  PollenId,
  ScoreStatus,
  SportId,
  SportScore,
} from "./types";

const SPORTS: { id: SportId; shortLabel: string; icon: string }[] = [
  { id: "easy_run", shortLabel: "Course tranquille", icon: "↗" },
  { id: "hard_run", shortLabel: "Course intense", icon: "⚡" },
  { id: "cycling", shortLabel: "Vélo", icon: "◇" },
  { id: "walking", shortLabel: "Marche", icon: "•" },
];

const LOCATION_SEARCH_MIN_LENGTH = 3;
const LOCATION_SEARCH_DEBOUNCE_MS = 350;

const STATUS_LABELS: Record<ScoreStatus, string> = {
  favorable: "Conditions favorables",
  correct: "Conditions correctes",
  mitigé: "Conditions mitigées",
  défavorable: "Conditions défavorables",
  "très défavorable": "Conditions très défavorables",
  incomplet: "Données incomplètes",
};

const STATUS_TONES: Record<ScoreStatus, string> = {
  favorable: "favorable",
  correct: "correct",
  mitigé: "mitige",
  défavorable: "defavorable",
  "très défavorable": "tres-defavorable",
  incomplet: "incomplet",
};

// Les seuils et recommandations restent définis par le backend ; ce mapping ne choisit que la
// présentation visuelle de la catégorie déjà calculée à partir de l’AQI original.
const AIR_CATEGORY_TONES: Record<AirQualityCategory, string> = {
  Bonne: "good",
  Acceptable: "acceptable",
  Modérée: "moderate",
  Mauvaise: "poor",
  "Très mauvaise": "very-poor",
  "Extrêmement mauvaise": "extremely-poor",
};

const POLLENS: { id: PollenId; label: string }[] = [
  { id: "alder", label: "Aulne" },
  { id: "birch", label: "Bouleau" },
  { id: "grass", label: "Graminées" },
  { id: "mugwort", label: "Armoise" },
  { id: "olive", label: "Olivier" },
  { id: "ragweed", label: "Ambroisie" },
];

const STALE_AFTER_MS = 60 * 60 * 1000;
const DECIMAL_FORMATTER = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});
const POLLEN_VALUE_FORMATTER = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 2,
});

function locationLabel(location: Location): string {
  return [location.name, location.admin1, location.country].filter(Boolean).join(", ");
}

function ScoreGauge({ score }: { score: number | null }) {
  const value = score ?? 0;
  const style = { "--score": `${value * 3.6}deg` } as CSSProperties;
  return (
    <div
      className="score-gauge"
      style={style}
      aria-label={score === null ? "Note globale indisponible" : `Note globale ${score} sur 100`}
    >
      <div className="score-gauge__inner">
        <strong>{score ?? "—"}</strong>
        <span>{score === null ? "Indisponible" : "sur 100"}</span>
      </div>
    </div>
  );
}

function ScoreSummary({
  label,
  score,
  detail,
}: {
  label: string;
  score: number | null;
  detail: string;
}) {
  return (
    <article className="score-summary">
      <p>{label}</p>
      <div
        className={`score-summary__value${
          score === null ? " score-summary__value--missing" : ""
        }`}
      >
        <strong>{score ?? "Indisponible"}</strong>
        {score !== null && <span>/ 100</span>}
      </div>
      <small>{detail}</small>
    </article>
  );
}

function mainExplanations(score: SportScore): string[] {
  const explanations = [...score.weather.reasons];
  if (score.air.reason) explanations.push(score.air.reason);
  return explanations.slice(0, 2);
}

function formatWeatherValue(value: number | null | undefined, unit: string): string {
  return value === null || value === undefined
    ? "Indisponible"
    : `${DECIMAL_FORMATTER.format(value)} ${unit}`;
}

function formatPollenValue(value: number): string {
  if (value > 0 && value < 0.01) return "< 0,01";
  return POLLEN_VALUE_FORMATTER.format(value);
}

function WeatherMetric({
  label,
  value,
  score,
}: {
  label: string;
  value: ReactNode;
  score: number | null | undefined;
}) {
  return (
    <article className="weather-metric">
      <div>
        <h4>{label}</h4>
        <div className="weather-metric__value">{value}</div>
      </div>
      <div
        className={`weather-metric__score${
          score === null || score === undefined ? " weather-metric__score--missing" : ""
        }`}
      >
        <span className="weather-metric__score-label">Sous-note</span>
        {score === null || score === undefined ? (
          <span>Indisponible</span>
        ) : (
          <>
            <strong>{score}</strong>
            <span>/ 100</span>
          </>
        )}
      </div>
    </article>
  );
}

export default function App() {
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [sport, setSport] = useState<SportId>("easy_run");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheckAt, setLastCheckAt] = useState<number | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const forecastRequest = useRef(0);
  const activeRefresh = useRef<number | null>(null);
  const locationSearchRequest = useRef(0);
  const locationSearchAbort = useRef<AbortController | null>(null);
  const locationSearchTimer = useRef<number | null>(null);

  const selectedHour =
    forecast?.hours.find((hour) => hour.time === selectedTime) ?? forecast?.hours[0] ?? null;
  const selectedScore = selectedHour?.scores[sport] ?? null;
  const selectedExplanations = selectedScore ? mainExplanations(selectedScore) : [];
  // Le facteur température porte le ressenti retenu pour l’activité ; la valeur du facteur vent
  // reste un intermédiaire de calcul et n’est donc jamais présentée comme une mesure prévue.
  const temperatureFactor = selectedScore?.weather.factors.find(
    (factor) => factor.id === "temperature",
  );
  const rainFactor = selectedScore?.weather.factors.find((factor) => factor.id === "rain");
  const windFactor = selectedScore?.weather.factors.find((factor) => factor.id === "wind");
  // Une concentration égale à zéro est une prévision disponible, contrairement à null.
  const hasPollenData = selectedHour
    ? POLLENS.some((pollen) => selectedHour.pollen[pollen.id] !== null)
    : false;
  const bestAvailableHour = useMemo(
    () => (forecast ? findBestHour(forecast.hours, sport) : null),
    [forecast, sport],
  );
  const bestHour = forecast?.recommendation_available ? bestAvailableHour : null;
  const bestHourIsUnfavorable = bestHour ? hasUnfavorableOverall(bestHour, sport) : false;
  const forecastDays = useMemo(
    () => (forecast ? groupByLocalDate(forecast.hours, forecast.timezone) : []),
    [forecast],
  );

  useEffect(() => {
    if (!forecast) {
      setSelectedTime(null);
      return;
    }
    if (!selectedTime || !forecast.hours.some((hour) => hour.time === selectedTime)) {
      setSelectedTime(forecast.hours[0]?.time ?? null);
    }
  }, [forecast, selectedTime]);

  const runLocationSearch = useCallback(async (searchQuery: string) => {
    const requestId = ++locationSearchRequest.current;
    locationSearchAbort.current?.abort();
    const controller = new AbortController();
    locationSearchAbort.current = controller;
    setSearchingLocations(true);
    setLoadingForecast(false);
    setRefreshing(false);
    setLocations([]);
    setSearchError(null);
    setForecastError(null);
    setForecast(null);
    setSelectedLocation(null);
    setSelectedTime(null);
    setLastCheckAt(null);
    activeRefresh.current = null;
    // Une nouvelle recherche invalide un chargement ou une actualisation encore en cours.
    forecastRequest.current += 1;
    try {
      const results = await searchLocations(searchQuery, controller.signal);
      if (requestId !== locationSearchRequest.current) return;
      setLocations(results);
      if (results.length === 0) {
        setSearchError("Aucune ville trouvée. Vérifiez l’orthographe ou précisez le pays.");
      }
    } catch (caughtError) {
      if (requestId !== locationSearchRequest.current || controller.signal.aborted) return;
      setSearchError(caughtError instanceof Error ? caughtError.message : "Recherche impossible.");
    } finally {
      if (requestId === locationSearchRequest.current) {
        setSearchingLocations(false);
        if (locationSearchAbort.current === controller) locationSearchAbort.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const searchQuery = query.trim();

    // Toute nouvelle frappe invalide immédiatement le délai ou la réponse de la saisie précédente.
    if (locationSearchTimer.current !== null) {
      window.clearTimeout(locationSearchTimer.current);
      locationSearchTimer.current = null;
    }
    locationSearchRequest.current += 1;
    locationSearchAbort.current?.abort();
    locationSearchAbort.current = null;
    setSearchingLocations(false);
    setLocations([]);
    setSearchError(null);

    if (searchQuery.length < LOCATION_SEARCH_MIN_LENGTH) return;

    const timer = window.setTimeout(() => {
      if (locationSearchTimer.current === timer) locationSearchTimer.current = null;
      void runLocationSearch(searchQuery);
    }, LOCATION_SEARCH_DEBOUNCE_MS);
    locationSearchTimer.current = timer;

    return () => {
      window.clearTimeout(timer);
      if (locationSearchTimer.current === timer) locationSearchTimer.current = null;
    };
  }, [query, runLocationSearch]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const searchQuery = query.trim();
    if (searchQuery.length < LOCATION_SEARCH_MIN_LENGTH) return;
    if (locationSearchTimer.current !== null) {
      window.clearTimeout(locationSearchTimer.current);
      locationSearchTimer.current = null;
    }
    void runLocationSearch(searchQuery);
  }

  async function loadInitialForecast(location: Location) {
    const requestId = ++forecastRequest.current;
    setSelectedLocation(location);
    setLoadingForecast(true);
    setRefreshing(false);
    setSearchError(null);
    setForecastError(null);
    setForecast(null);
    setSelectedTime(null);
    setLastCheckAt(null);
    activeRefresh.current = null;
    try {
      const nextForecast = await getForecast(location);
      if (requestId !== forecastRequest.current) return;
      setForecast(nextForecast);
      setSelectedTime(nextForecast.hours[0]?.time ?? null);
      setLastCheckAt(Date.now());
    } catch (caughtError) {
      if (requestId !== forecastRequest.current) return;
      setForecastError(
        caughtError instanceof Error
          ? caughtError.message
          : "Le service est momentanément indisponible.",
      );
    } finally {
      if (requestId === forecastRequest.current) setLoadingForecast(false);
    }
  }

  function chooseLocation(location: Location) {
    setLocations([]);
    void loadInitialForecast(location);
  }

  const refreshForecast = useCallback(async () => {
    if (!selectedLocation || !forecast || activeRefresh.current !== null) return;
    const requestId = ++forecastRequest.current;
    activeRefresh.current = requestId;
    setRefreshing(true);
    try {
      const nextForecast = await getForecast(selectedLocation);
      if (requestId !== forecastRequest.current) return;
      setForecast(nextForecast);
    } catch {
      if (requestId !== forecastRequest.current) return;
      setForecast((current) => {
        if (!current) return current;
        const retrievedAt = Date.parse(current.generated_at);
        const age = Date.now() - retrievedAt;
        const stale =
          current.data_state === "stale" || !Number.isFinite(age) || age > STALE_AFTER_MS;
        return {
          ...current,
          data_state: stale ? "stale" : "refresh_failed",
          recommendation_available: stale ? false : current.recommendation_available,
        };
      });
    } finally {
      if (activeRefresh.current === requestId) activeRefresh.current = null;
      if (requestId === forecastRequest.current) {
        setRefreshing(false);
        setLastCheckAt(Date.now());
      }
    }
  }, [forecast, selectedLocation]);

  useEffect(() => {
    if (!forecast || !selectedLocation || lastCheckAt === null) return;
    const delay = periodicRefreshDelay(lastCheckAt, Date.now());
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") void refreshForecast();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [forecast, lastCheckAt, refreshForecast, selectedLocation]);

  useEffect(() => {
    if (!forecast || !selectedLocation) return;
    const delay = boundaryRefreshDelay(
      forecast.hours[0]?.time ?? "",
      lastCheckAt,
      Date.now(),
    );
    if (delay === null) return;
    if (delay === 0) {
      if (document.visibilityState === "visible") void refreshForecast();
      return;
    }

    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") void refreshForecast();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [forecast, lastCheckAt, refreshForecast, selectedLocation]);

  useEffect(() => {
    if (!forecast || !selectedLocation) return;
    const currentForecast = forecast;

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (
        shouldRefreshWhenVisible(
          currentForecast.hours[0]?.time ?? "",
          currentForecast.generated_at,
          currentForecast.data_state,
          lastCheckAt,
          Date.now(),
        )
      ) {
        void refreshForecast();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [forecast, lastCheckAt, refreshForecast, selectedLocation]);

  function chooseSport(nextSport: SportId) {
    setSport(nextSport);
  }

  return (
    <main>
      <header className="hero" id="top">
        <nav>
          <a className="brand" href="#top" aria-label="Mouv’Air, accueil">
            <span className="brand__mark">M</span>
            Mouv’Air
          </a>
          <span className="live-dot"><i /> Données horaires</span>
        </nav>

        <div className="hero__copy">
          <p className="eyebrow">Météo · air · mouvement</p>
          <h1>Le bon moment<br />pour sortir.</h1>
          <p className="intro">
            Une note claire pour choisir quand courir, pédaler ou marcher selon les conditions
            près de chez vous.
          </p>
        </div>

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

        {locations.length > 0 && (
          <div className="location-results" aria-label="Résultats de recherche">
            {locations.map((location) => (
              <button key={location.id} onClick={() => chooseLocation(location)}>
                <strong>{location.name}</strong>
                <span>{[location.admin1, location.country].filter(Boolean).join(" · ")}</span>
              </button>
            ))}
          </div>
        )}
        {searchError && <p className="error">{searchError}</p>}
      </header>

      {loadingForecast && selectedLocation && (
        <section className="forecast-state" aria-live="polite" aria-busy="true">
          <span className="forecast-state__spinner" aria-hidden="true" />
          <p className="eyebrow">{locationLabel(selectedLocation)}</p>
          <h2>Chargement des prévisions pour {selectedLocation.name}…</h2>
        </section>
      )}

      {!loadingForecast && forecastError && selectedLocation && !forecast && (
        <section className="forecast-state forecast-state--error" role="alert">
          <p className="eyebrow">{locationLabel(selectedLocation)}</p>
          <h2>Impossible de charger les prévisions</h2>
          <p>{forecastError}</p>
          <button type="button" onClick={() => void loadInitialForecast(selectedLocation)}>
            Réessayer
          </button>
        </section>
      )}

      {forecast && selectedHour && selectedScore && selectedLocation && (
        <section className="dashboard">
          <div className="dashboard__heading">
            <div>
              <p className="eyebrow">{locationLabel(selectedLocation)}</p>
              <h2>Vos conditions sur 24 h</h2>
              <p className="timezone-label">
                {formatTimeZoneLabel(selectedHour.time, selectedHour.end_time, forecast.timezone)}
              </p>
            </div>
            <div className="dashboard__actions">
              <div className="data-refresh">
                <span>
                  Données récupérées à {formatLocalTime(forecast.generated_at, forecast.timezone)}
                </span>
                <button type="button" onClick={() => void refreshForecast()} disabled={refreshing}>
                  {refreshing ? "Actualisation…" : "Actualiser"}
                </button>
              </div>
              <div className="best-slot-panel">
                {bestHour ? (
                  <button
                    className="best-slot"
                    onClick={() => setSelectedTime(bestHour.time)}
                  >
                    <span>Meilleur créneau</span>
                    <strong>
                      {formatSlot(bestHour.time, bestHour.end_time, forecast.timezone, "short")}
                    </strong>
                    <b>{bestHour.scores[sport].overall.score}/100</b>
                  </button>
                ) : (
                  <button className="best-slot" type="button" disabled>
                    <span>Meilleur créneau</span>
                    <strong>
                      {forecast.recommendation_available
                        ? "Aucun créneau complet"
                        : "Recommandation suspendue"}
                    </strong>
                  </button>
                )}
                {bestHourIsUnfavorable && (
                  <small className="best-slot-warning" role="status">
                    Même le meilleur créneau présente des conditions défavorables.
                  </small>
                )}
                {!forecast.recommendation_available && (
                  <small className="best-slot-help">Les données sont trop anciennes.</small>
                )}
                {forecast.recommendation_available && !bestAvailableHour && (
                  <small className="best-slot-help">Aucune note globale n’est disponible.</small>
                )}
              </div>
            </div>
          </div>

          {forecast.data_state === "stale" ? (
            <p className="data-notice data-notice--stale" role="status">
              Données anciennes — dernières données récupérées à{" "}
              {formatLocalTime(forecast.generated_at, forecast.timezone)}. Les notes sont indicatives
              et le meilleur créneau est suspendu.
            </p>
          ) : forecast.data_state === "refresh_failed" ? (
            <p className="data-notice" role="status">
              Actualisation impossible — dernières données récupérées à{" "}
              {formatLocalTime(forecast.generated_at, forecast.timezone)}.
            </p>
          ) : null}

          <div className="sport-tabs" role="tablist" aria-label="Choisir une activité">
            {SPORTS.map((item) => (
              <button
                className={sport === item.id ? "active" : ""}
                key={item.id}
                onClick={() => chooseSport(item.id)}
                role="tab"
                aria-selected={sport === item.id}
              >
                <span>{item.icon}</span>
                {item.shortLabel}
              </button>
            ))}
          </div>

          <div className={`score-card score-card--${STATUS_TONES[selectedScore.overall.status]}`}>
            <header className="score-card__context">
              <div>
                <p className="eyebrow">Créneau sélectionné</p>
                <h3>{formatSlot(selectedHour.time, selectedHour.end_time, forecast.timezone)}</h3>
              </div>
              <span className="activity-chip">{selectedScore.label}</span>
            </header>

            <div className="score-card__notes">
              <section className="score-card__overall" aria-label="Note globale">
                <p className="score-card__label">Note globale</p>
                <ScoreGauge score={selectedScore.overall.score} />
                <div>
                  <h3>{STATUS_LABELS[selectedScore.overall.status]}</h3>
                  {selectedScore.overall.score === null && (
                    <p>
                      La météo et la qualité de l’air sont toutes deux nécessaires pour la calculer.
                    </p>
                  )}
                </div>
              </section>

              <div className="score-card__secondary" aria-label="Notes détaillées">
                <ScoreSummary
                  label="Note météo"
                  score={selectedScore.weather.score}
                  detail={STATUS_LABELS[selectedScore.weather.status]}
                />
                <ScoreSummary
                  label="Note qualité de l’air"
                  score={selectedScore.air.score}
                  detail={selectedScore.air.category ?? "Données incomplètes"}
                />
              </div>
            </div>

            {selectedScore.weather.alerts.length > 0 && (
              <section className="weather-alerts" aria-label="Alertes météo">
                <strong>Alertes météo</strong>
                <ul>
                  {selectedScore.weather.alerts.map((alert) => (
                    <li key={alert}>{alert}</li>
                  ))}
                </ul>
              </section>
            )}

            {selectedExplanations.length > 0 && (
              <section className="score-reasons" aria-label="Explications principales">
                <strong>À retenir</strong>
                <ul>
                  {selectedExplanations.map((explanation) => (
                    <li key={explanation}>{explanation}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <section className="conditions-details" aria-labelledby="weather-details-title">
            <header className="conditions-details__header">
              <div>
                <p className="eyebrow">Détail du créneau</p>
                <h3 id="weather-details-title">Météo</h3>
              </div>
              <p>Conditions retenues pour ce créneau de 1 h</p>
            </header>

            <div className="weather-metrics">
              <WeatherMetric
                label="Température ressentie"
                value={formatWeatherValue(temperatureFactor?.value, "°C")}
                score={temperatureFactor?.score}
              />
              <WeatherMetric
                label="Précipitations sur l’heure"
                value={formatWeatherValue(selectedHour.conditions.precipitation, "mm")}
                score={rainFactor?.score}
              />
              <WeatherMetric
                label="Vent et rafales"
                value={
                  <div className="weather-metric__wind-values">
                    <span>
                      Vent moyen
                      <strong>
                        {formatWeatherValue(selectedHour.conditions.wind_speed, "km/h")}
                      </strong>
                    </span>
                    <span>
                      Rafales
                      <strong>
                        {formatWeatherValue(selectedHour.conditions.wind_gusts, "km/h")}
                      </strong>
                    </span>
                  </div>
                }
                score={windFactor?.score}
              />
            </div>
          </section>

          <section className="conditions-details" aria-labelledby="air-details-title">
            <header className="conditions-details__header">
              <div>
                <p className="eyebrow">Détail du créneau</p>
                <h3 id="air-details-title">Qualité de l’air</h3>
              </div>
              <p>Indice européen de qualité de l’air</p>
            </header>

            {selectedScore.air.aqi === null ? (
              <div className="air-details__unavailable" role="status">
                <strong>Qualité de l’air indisponible</strong>
                <p>L’indice AQI européen n’est pas disponible pour ce créneau.</p>
              </div>
            ) : (
              <div className="air-details__content">
                <div className="air-index">
                  <p>AQI européen</p>
                  <div className="air-index__value">
                    <strong>{DECIMAL_FORMATTER.format(selectedScore.air.aqi)}</strong>
                    <span>indice</span>
                  </div>
                  {selectedScore.air.category ? (
                    <span
                      className={`air-category air-category--${
                        AIR_CATEGORY_TONES[selectedScore.air.category]
                      }`}
                    >
                      {selectedScore.air.category}
                    </span>
                  ) : (
                    <span className="air-category air-category--missing">
                      Catégorie indisponible
                    </span>
                  )}
                  <small>Indice de pollution sans unité : ce n’est pas un pourcentage.</small>
                </div>

                <div className="air-recommendations">
                  <article>
                    <span>Population générale</span>
                    <p>
                      {selectedScore.air.recommendations?.general_population ??
                        "Recommandation indisponible."}
                    </p>
                  </article>
                  <article>
                    <span>Personnes sensibles</span>
                    <p>
                      {selectedScore.air.recommendations?.sensitive_people ??
                        "Recommandation indisponible."}
                    </p>
                  </article>
                </div>
              </div>
            )}
          </section>

          <section className="conditions-details" aria-labelledby="pollen-details-title">
            <header className="conditions-details__header">
              <div>
                <p className="eyebrow">Détail du créneau</p>
                <h3 id="pollen-details-title">Pollens prévus</h3>
              </div>
              <p>Concentrations horaires en grains/m³</p>
            </header>

            {hasPollenData ? (
              <div className="pollen-grid">
                {POLLENS.map((pollen) => {
                  const value = selectedHour.pollen[pollen.id];
                  return (
                    <article
                      className={`pollen-item${value === null ? " pollen-item--missing" : ""}`}
                      key={pollen.id}
                    >
                      <span>{pollen.label}</span>
                      {value === null ? (
                        <strong>Indisponible</strong>
                      ) : (
                        <div className="pollen-item__value">
                          <strong>{formatPollenValue(value)}</strong>
                          <small>grains/m³</small>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="pollen-details__unavailable" role="status">
                <strong>Prévisions de pollen indisponibles pour ce lieu ou ce créneau</strong>
              </div>
            )}

            <p className="pollen-details__notice">
              Information pollen présentée séparément ; elle n’entre pas dans les notes Mouv’Air.
            </p>
          </section>

          <section className="timeline-wrap" aria-labelledby="timeline-title">
            <h3 id="timeline-title">Heure par heure</h3>
            <div className="timeline-days">
              {forecastDays.map((day) => (
                <section className="timeline-day" key={day.key}>
                  <h4>{day.label}</h4>
                  <div className="slot-grid">
                    {day.items.map((hour) => {
                      const score = hour.scores[sport];
                      const selected = selectedHour.time === hour.time;
                      const best = bestHour?.time === hour.time;
                      const alerts = score.weather.alerts.length;
                      return (
                        <button
                          key={hour.time}
                          className={`slot-card slot-card--${STATUS_TONES[score.overall.status]}${
                            best ? " slot-card--best" : ""
                          }${selected ? " active" : ""}`}
                          onClick={() => setSelectedTime(hour.time)}
                          aria-pressed={selected}
                        >
                          <span className="slot-card__header">
                            <strong>
                              {formatLocalInterval(
                                hour.time,
                                hour.end_time,
                                forecast.timezone,
                              )}
                            </strong>
                            {(best || selected) && (
                              <span className="slot-card__badges">
                                {best && <span className="slot-card__best">Meilleur créneau</span>}
                                {selected && (
                                  <span className="slot-card__selected">Sélectionné</span>
                                )}
                              </span>
                            )}
                          </span>
                          <span className="slot-card__result">
                            {score.overall.score === null ? (
                              <strong className="slot-card__missing">Données incomplètes</strong>
                            ) : (
                              <>
                                <span className="slot-card__score">
                                  <strong>{score.overall.score}</strong>
                                  <small>/ 100</small>
                                </span>
                                <span>{STATUS_LABELS[score.overall.status]}</span>
                              </>
                            )}
                          </span>
                          {alerts > 0 && (
                            <span className="slot-card__alert">
                              {alerts === 1 ? "Alerte météo" : `${alerts} alertes météo`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </section>
      )}

      {!forecast && !searchingLocations && !loadingForecast && !forecastError && (
        <section className="empty-state">
          <span>01</span>
          <p>Recherchez une ville pour comparer les quatre activités sur les prochaines 24 heures.</p>
        </section>
      )}

      <footer>
        <p>Un indicateur de conditions extérieures, pas un avis médical.</p>
        <p>Données météo Open-Meteo · Qualité de l’air CAMS ENSEMBLE via Open-Meteo</p>
      </footer>
    </main>
  );
}
