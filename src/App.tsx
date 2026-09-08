import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";

import { getForecast, searchLocations } from "./api";
import { formatSlot, formatTimeZoneLabel } from "./dateTime";
import type { Forecast, ForecastHour, Location, SportId } from "./types";

const SPORTS: { id: SportId; shortLabel: string; icon: string }[] = [
  { id: "easy_run", shortLabel: "Course tranquille", icon: "↗" },
  { id: "hard_run", shortLabel: "Course intense", icon: "⚡" },
  { id: "cycling", shortLabel: "Vélo", icon: "◇" },
  { id: "walking", shortLabel: "Marche", icon: "•" },
];

const STATUS_LABELS = {
  favorable: "Conditions favorables",
  correct: "Bon créneau",
  mitigé: "Conditions mitigées",
  défavorable: "Conditions défavorables",
  incomplet: "Données incomplètes",
};

function locationLabel(location: Location): string {
  return [location.name, location.admin1, location.country].filter(Boolean).join(", ");
}

function ScoreGauge({ score }: { score: number | null }) {
  const value = score ?? 0;
  const style = { "--score": `${value * 3.6}deg` } as CSSProperties;
  return (
    <div className="score-gauge" style={style}>
      <div className="score-gauge__inner">
        <strong>{score ?? "—"}</strong>
        <span>sur 100</span>
      </div>
    </div>
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
  const [error, setError] = useState<string | null>(null);

  const selectedHour =
    forecast?.hours.find((hour) => hour.time === selectedTime) ?? forecast?.hours[0] ?? null;
  const selectedScore = selectedHour?.scores[sport] ?? null;
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
    setError(null);
    setForecast(null);
    setSelectedTime(null);
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
    setSelectedLocation(location);
    setLocations([]);
    setLoading(true);
    setError(null);
    setForecast(null);
    setSelectedTime(null);
    try {
      const nextForecast = await getForecast(location);
      setForecast(nextForecast);
      setSelectedTime(nextForecast.hours[0]?.time ?? null);
    } catch (forecastError) {
      setError(forecastError instanceof Error ? forecastError.message : "Prévisions indisponibles.");
    } finally {
      setLoading(false);
    }
  }

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
          </div>

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

          <div className={`score-card score-card--${selectedScore.status}`}>
            <div className="score-card__primary">
              <p className="eyebrow">
                {formatSlot(selectedHour.time, selectedHour.end_time, forecast.timezone)}
              </p>
              <ScoreGauge score={selectedScore.score} />
              <div>
                <h3>{STATUS_LABELS[selectedScore.status]}</h3>
                <p>{selectedScore.reasons.join(" ")}</p>
              </div>
            </div>

            <div className="factors">
              {selectedScore.factors.map((factor) => (
                <article key={factor.id}>
                  <div>
                    <span>{factor.label}</span>
                    <strong>
                      {factor.value.toFixed(factor.id === "rain" ? 1 : 0)} {factor.unit}
                    </strong>
                  </div>
                  <div className="factor-bar" aria-label={`Sous-note ${factor.score} sur 100`}>
                    <i style={{ width: `${factor.score}%` }} />
                  </div>
                  <small>{factor.score}/100</small>
                </article>
              ))}
            </div>
          </div>

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
