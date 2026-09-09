import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";

import { getForecast, searchLocations } from "./api";
import { formatLocalTime, formatSlot, formatTimeZoneLabel } from "./dateTime";
import {
  boundaryRefreshDelay,
  periodicRefreshDelay,
  shouldRefreshWhenVisible,
} from "./refreshSchedule";
import type {
  Forecast,
  ForecastHour,
  Location,
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

const STALE_AFTER_MS = 60 * 60 * 1000;
const WEATHER_VALUE_FORMATTER = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
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
    : `${WEATHER_VALUE_FORMATTER.format(value)} ${unit}`;
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
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheckAt, setLastCheckAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const forecastRequest = useRef(0);
  const activeRefresh = useRef<number | null>(null);

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
  const bestHour = useMemo(() => {
    if (!forecast?.recommendation_available) return null;
    return forecast.hours.reduce<ForecastHour | null>((best, hour) => {
      const score = hour.scores[sport].overall.score;
      if (score === null) return best;
      const bestScore = best?.scores[sport].overall.score;
      return bestScore === null || bestScore === undefined || score > bestScore ? hour : best;
    }, null);
  }, [forecast, sport]);

  useEffect(() => {
    if (!forecast) {
      setSelectedTime(null);
      return;
    }
    if (!selectedTime || !forecast.hours.some((hour) => hour.time === selectedTime)) {
      setSelectedTime(forecast.hours[0]?.time ?? null);
    }
  }, [forecast, selectedTime]);

  async function handleSearch(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setRefreshing(false);
    setError(null);
    setForecast(null);
    setSelectedTime(null);
    setLastCheckAt(null);
    activeRefresh.current = null;
    forecastRequest.current += 1;
    try {
      const results = await searchLocations(query.trim());
      setLocations(results);
      if (results.length === 0) setError("Aucune ville trouvée.");
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Recherche impossible.");
    } finally {
      setLoading(false);
    }
  }

  async function chooseLocation(location: Location) {
    const requestId = ++forecastRequest.current;
    setSelectedLocation(location);
    setLocations([]);
    setLoading(true);
    setRefreshing(false);
    setError(null);
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
    } catch (forecastError) {
      if (requestId !== forecastRequest.current) return;
      setError(forecastError instanceof Error ? forecastError.message : "Prévisions indisponibles.");
    } finally {
      if (requestId === forecastRequest.current) setLoading(false);
    }
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
              minLength={2}
            />
            <button type="submit" disabled={loading}>
              {loading ? "Recherche…" : "Voir les conditions"}
            </button>
          </div>
        </form>

        {locations.length > 0 && (
          <div className="location-results" aria-label="Résultats de recherche">
            {locations.map((location) => (
              <button key={location.id} onClick={() => void chooseLocation(location)}>
                <strong>{location.name}</strong>
                <span>{[location.admin1, location.country].filter(Boolean).join(" · ")}</span>
              </button>
            ))}
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </header>

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
              {bestHour && (
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
              )}
              {!forecast.recommendation_available && (
                <button className="best-slot" type="button" disabled>
                  <span>Meilleur créneau</span>
                  <strong>Données trop anciennes</strong>
                </button>
              )}
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

          <div className="timeline-wrap">
            <h3>Heure par heure</h3>
            <div className="timeline">
              {forecast.hours.map((hour) => (
                <button
                  key={hour.time}
                  className={selectedHour.time === hour.time ? "active" : ""}
                  onClick={() => setSelectedTime(hour.time)}
                >
                  <span>{formatSlot(hour.time, hour.end_time, forecast.timezone, "short")}</span>
                  <strong>{hour.scores[sport].score ?? "—"}</strong>
                  <i className={`status-dot status-dot--${hour.scores[sport].status}`} />
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {!forecast && !loading && (
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
