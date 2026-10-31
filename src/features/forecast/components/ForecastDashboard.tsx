/**
 * Tableau de bord des prévisions et état de sélection de l’utilisateur.
 * Les données et l’action d’actualisation viennent du parent ; l’activité, l’onglet de détail et le créneau
 * consulté restent locaux à cette vue. Le graphique précède les détails pour choisir une heure avant
 * d’en consulter les mesures ; les sous-vues reçoivent toutes le même créneau et le même score.
 */

import { useEffect, useMemo, useState } from "react";

import { formatLocalTime, formatSlot, formatTimeZoneLabel } from "../../../shared/lib/dateTime";
import { locationLabel } from "../../locations/lib/locationLabel";
import type { Location } from "../../locations/types";
import { findBestHour, hasUnfavorableOverall } from "../lib/forecastRanking";
import type { Forecast, SportId } from "../types";
import { ConditionsDetails } from "./details/ConditionsDetails";
import type { DetailTabId } from "./details/ConditionsDetails";
import { HourlyScoreChart } from "./HourlyScoreChart";
import { ScoreCard } from "./ScoreCard";
import "./ForecastDashboard.css";

/**
 * Ordre de présentation et libellés courts des activités ; les identifiants correspondent aux clés de scores.
 */
const SPORTS: { id: SportId; shortLabel: string; icon: string }[] = [
  { id: "easy_run", shortLabel: "Course tranquille", icon: "↗" },
  { id: "hard_run", shortLabel: "Course intense", icon: "⚡" },
  { id: "cycling", shortLabel: "Vélo", icon: "◇" },
  { id: "walking", shortLabel: "Marche", icon: "•" },
];

/**
 * Une absence de données masque le rendu sans retirer le composant de l’arbre React.
 * L’actualisation est une action du parent pour que ce composant se concentre sur la consultation.
 */
type ForecastDashboardProps = {
  forecast: Forecast | null;
  location: Location | null;
  refreshing: boolean;
  onRefresh: () => void;
};

/**
 * Assemble le contexte local, le meilleur créneau, les notes, les détails et le graphique.
 * Une meilleure note n’est mise en avant que si l’API autorise encore la recommandation ; l’absence
 * de créneau complet et la suspension pour ancienneté ont donc deux présentations différentes.
 */
export function ForecastDashboard({
  forecast,
  location: selectedLocation,
  refreshing,
  onRefresh,
}: ForecastDashboardProps) {
  // Ce composant reste monté entre deux villes pour conserver l’activité et l’onglet choisis.
  const [sport, setSport] = useState<SportId>("easy_run");
  const [detailTab, setDetailTab] = useState<DetailTabId>("weather");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  /**
   * Le timestamp sert d’identité stable lors des actualisations. Le premier créneau fournit un repli
   * immédiat pour le rendu si l’ancien créneau a disparu ; l’effet synchronise ensuite la sélection stockée.
   */
  const selectedHour =
    forecast?.hours.find((hour) => hour.time === selectedTime) ?? forecast?.hours[0] ?? null;
  const selectedScore = selectedHour?.scores[sport] ?? null;
  /**
   * La recherche du maximum dépend de toutes les notes de l’activité choisie ; sa mémorisation évite
   * de la refaire lors d’un simple changement d’onglet ou de créneau sélectionné.
   */
  const bestAvailableHour = useMemo(
    () => (forecast ? findBestHour(forecast.hours, sport) : null),
    [forecast, sport],
  );
  const bestHour = forecast?.recommendation_available ? bestAvailableHour : null;
  const bestHourIsUnfavorable = bestHour ? hasUnfavorableOverall(bestHour, sport) : false;

  /**
   * Conserve la sélection pendant une actualisation tant que son créneau existe dans la nouvelle réponse.
   * Une recherche sans prévisions remet la sélection à zéro ; un nouveau jeu de données commence
   * sur son premier créneau sans réinitialiser l’activité ni le panneau choisis.
   */
  useEffect(() => {
    if (!forecast) {
      setSelectedTime(null);
      return;
    }
    if (!selectedTime || !forecast.hours.some((hour) => hour.time === selectedTime)) {
      setSelectedTime(forecast.hours[0]?.time ?? null);
    }
  }, [forecast, selectedTime]);

  /**
   * Ce retour intervient après tous les hooks pour conserver leur ordre entre l’attente et le résultat.
   * Un jeu de prévisions vide ne produit donc pas de carte avec un score ou un horaire inventé.
   */
  if (!forecast || !selectedHour || !selectedScore || !selectedLocation) return null;

  return (
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
            <button type="button" onClick={onRefresh} disabled={refreshing}>
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
            onClick={() => setSport(item.id)}
            role="tab"
            aria-selected={sport === item.id}
          >
            <span>{item.icon}</span>
            {item.shortLabel}
          </button>
        ))}
      </div>

      <ScoreCard hour={selectedHour} score={selectedScore} timeZone={forecast.timezone} />

      <section className="timeline-wrap" aria-labelledby="timeline-title">
        <div className="timeline-wrap__heading">
          <h3 id="timeline-title">Heure par heure</h3>
          <p>Note globale sur 100 pour {selectedScore.label.toLowerCase()}</p>
        </div>
        <HourlyScoreChart
          hours={forecast.hours}
          sport={sport}
          selectedTime={selectedHour.time}
          bestTime={bestHour?.time ?? null}
          timeZone={forecast.timezone}
          onSelect={setSelectedTime}
        />
      </section>

      <ConditionsDetails
        hour={selectedHour}
        score={selectedScore}
        detailTab={detailTab}
        onTabChange={setDetailTab}
      />
    </section>
  );
}
