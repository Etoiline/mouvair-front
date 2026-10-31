/**
 * Synthèse d’un créneau pour une activité : note globale, notes météo et air, alertes et raisons.
 * La vue utilise exclusivement les résultats de l’API. Elle présente les données disponibles même
 * si l’absence d’une source empêche de calculer la note globale.
 */

import type { CSSProperties } from "react";

import { formatSlot } from "../../../shared/lib/dateTime";
import { STATUS_LABELS, STATUS_TONES } from "../lib/scorePresentation";
import type { ForecastHour, SportScore } from "../types";
import "./ScoreCard.css";

/**
 * Convertit la note sur 100 en degrés pour le dégradé conique défini dans le CSS.
 * Une note null produit un arc vide mais conserve un libellé d’indisponibilité : l’arc vide ne doit
 * pas faire croire qu’une note nulle a été mesurée. aria-label porte la valeur accessible complète.
 */
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

/**
 * Présente une note secondaire avec son contexte et réserve un affichage explicite aux données absentes.
 * Le suffixe / 100 n’accompagne que les valeurs numériques ; le détail reste visible dans les deux cas.
 */
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

/**
 * Conserve au plus deux raisons, dans l’ordre météo puis qualité de l’air.
 * La copie évite de modifier le tableau reçu de l’API. Les alertes météo ne sont pas limitées ici,
 * car elles sont affichées dans une section distincte de la carte.
 */
function mainExplanations(score: SportScore): string[] {
  const explanations = [...score.weather.reasons];
  if (score.air.reason) explanations.push(score.air.reason);
  return explanations.slice(0, 2);
}

/**
 * Le créneau porte les horaires et le score porte l’activité choisie ; timeZone vient de la réponse complète.
 */
type ScoreCardProps = {
  hour: ForecastHour;
  score: SportScore;
  timeZone: string;
};

/**
 * Ordonne la lecture du contexte vers la note globale, puis les notes par source et les explications.
 * Le statut global pilote la couleur de la carte. Les alertes sont conservées intégralement, et les
 * sections sans contenu ne créent pas de panneaux vides sous les notes.
 */
export function ScoreCard({ hour, score, timeZone }: ScoreCardProps) {
  const selectedExplanations = mainExplanations(score);
  // Une espace insécable garde le symbole h avec sa valeur quand l’horaire passe sur plusieurs lignes.
  const slotLabel = formatSlot(hour.time, hour.end_time, timeZone).replaceAll(" h", "\u00a0h");

  return (
    <div className={`score-card score-card--${STATUS_TONES[score.overall.status]}`}>
      <header className="score-card__context">
        <div>
          <p className="eyebrow">Créneau sélectionné</p>
          <h3>{slotLabel}</h3>
        </div>
        <span className="activity-chip">{score.label}</span>
      </header>

      <div className="score-card__notes">
        <section className="score-card__overall" aria-label="Note globale">
          <p className="score-card__label">Note globale</p>
          <ScoreGauge score={score.overall.score} />
          <div>
            <h3>{STATUS_LABELS[score.overall.status]}</h3>
            {score.overall.score === null && (
              <p>
                La météo et la qualité de l’air sont toutes deux nécessaires pour la calculer.
              </p>
            )}
          </div>
        </section>

        <div className="score-card__secondary" aria-label="Notes détaillées">
          <ScoreSummary
            label="Note météo"
            score={score.weather.score}
            detail={STATUS_LABELS[score.weather.status]}
          />
          <ScoreSummary
            label="Note qualité de l’air"
            score={score.air.score}
            detail={score.air.category ?? "Données incomplètes"}
          />
        </div>
      </div>

      {score.weather.alerts.length > 0 && (
        <section className="weather-alerts" aria-label="Alertes météo">
          <strong>Alertes météo</strong>
          <ul>
            {score.weather.alerts.map((alert) => (
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
  );
}
