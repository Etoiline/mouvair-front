/**
 * Présentation des mesures et sous-notes météo du créneau actif.
 * Les facteurs servent à retrouver les notes par identifiant. Pour les valeurs affichées, la température
 * vient du facteur retenu pour l’activité, tandis que pluie, vent moyen et rafales viennent des conditions brutes.
 */

import type { ReactNode } from "react";

import { formatWeatherValue } from "../../lib/formatConditions";
import type { ForecastHour, SportScore } from "../../types";
import "./WeatherDetails.css";

/**
 * Carte de mesure réutilisée pour les trois familles météo.
 * value accepte aussi un bloc React pour présenter ensemble vent moyen et rafales. La sous-note
 * est traitée séparément de la mesure : l’une peut être absente sans masquer l’autre, et 0 reste valide.
 */
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

/**
 * Associe les trois mesures aux sous-notes de température, pluie et vent sans dépendre de l’ordre
 * des facteurs reçus. Un facteur omis produit une sous-note indisponible ; les mesures restantes
 * continuent d’être affichées avec leur unité via le formateur commun.
 */
export function WeatherDetails({ hour, score }: { hour: ForecastHour; score: SportScore }) {
  // Le facteur température porte le ressenti retenu pour l’activité ; la valeur du facteur vent
  // reste un intermédiaire de calcul et n’est donc jamais présentée comme une mesure prévue.
  const temperatureFactor = score.weather.factors.find(
    (factor) => factor.id === "temperature",
  );
  const rainFactor = score.weather.factors.find((factor) => factor.id === "rain");
  const windFactor = score.weather.factors.find((factor) => factor.id === "wind");

  return (
    <div className="weather-metrics">
      <WeatherMetric
        label="Température ressentie"
        value={formatWeatherValue(temperatureFactor?.value, "°C")}
        score={temperatureFactor?.score}
      />
      <WeatherMetric
        label="Précipitations sur l’heure"
        value={formatWeatherValue(hour.conditions.precipitation, "mm")}
        score={rainFactor?.score}
      />
      <WeatherMetric
        label="Vent et rafales"
        value={
          <div className="weather-metric__wind-values">
            <span>
              Vent moyen
              <strong>
                {formatWeatherValue(hour.conditions.wind_speed, "km/h")}
              </strong>
            </span>
            <span>
              Rafales
              <strong>
                {formatWeatherValue(hour.conditions.wind_gusts, "km/h")}
              </strong>
            </span>
          </div>
        }
        score={windFactor?.score}
      />
    </div>
  );
}
