/**
 * Graphique horaire interactif sans bibliothèque de tracé.
 * Chaque créneau est un bouton natif : son clic sélectionne l’heure dans le parent et son nom accessible
 * résume la note, le statut et les repères utiles. Le CSS dessine les barres à partir de variables locales.
 */

import type { CSSProperties } from "react";

import { formatLocalDate, formatLocalTime, formatSlot, groupByLocalDate } from "../../../shared/lib/dateTime";
import { STATUS_LABELS, STATUS_TONES } from "../lib/scorePresentation";
import type { ForecastHour, ScoreStatus, SportId } from "../types";
import "./HourlyScoreChart.css";

/**
 * Légende ordonnée du favorable à l’incomplet, avec un vocabulaire compact.
 * Les suffixes de couleur proviennent de la même table que la carte de synthèse pour rester cohérents.
 */
const CHART_LEGEND: { status: ScoreStatus; label: string }[] = [
  { status: "favorable", label: "Favorable" },
  { status: "correct", label: "Correct" },
  { status: "mitigé", label: "Mitigé" },
  { status: "défavorable", label: "Défavorable" },
  { status: "très défavorable", label: "Très défavorable" },
  { status: "incomplet", label: "Incomplet" },
];

/**
 * Affiche les jours dans le fuseau du lieu, un axe de 0 à 100 et un bouton par créneau reçu.
 * selectedTime et bestTime sont deux informations indépendantes : consulter une autre heure ne doit
 * pas déplacer l’étoile de la meilleure option. onSelect confie la sélection au tableau de bord.
 */
export function HourlyScoreChart({
  hours,
  sport,
  selectedTime,
  bestTime,
  timeZone,
  onSelect,
}: {
  hours: ForecastHour[];
  sport: SportId;
  selectedTime: string;
  bestTime: string | null;
  timeZone: string;
  onSelect: (time: string) => void;
}) {
  /**
   * Le regroupement local évite de séparer les jours selon UTC alors que l’axe affiche l’heure du lieu.
   * Les groupes et les barres gardent exactement le même ordre afin que les en-têtes couvrent les bonnes colonnes.
   */
  const dayGroups = groupByLocalDate(hours, timeZone);
  const selectedHour = hours.find((hour) => hour.time === selectedTime) ?? hours[0];
  const selectedScore = selectedHour?.scores[sport];
  /**
   * La variable pilote le nombre de colonnes et la largeur minimale défilable.
   * La borne à 1 évite une grille CSS à zéro colonne si le composant reçoit exceptionnellement une liste vide.
   */
  const chartStyle = {
    "--hour-count": Math.max(hours.length, 1),
  } as CSSProperties;

  return (
    <div className="hourly-chart">
      <div className="hourly-chart__legend" aria-label="Légende du graphique">
        {CHART_LEGEND.map((item) => (
          <span key={item.status}>
            <i
              className={`hourly-chart__legend-color hourly-chart__legend-color--${
                STATUS_TONES[item.status]
              }`}
              aria-hidden="true"
            />
            {item.label}
          </span>
        ))}
        <span><b aria-hidden="true">★</b> Meilleur créneau</span>
        <span><b className="hourly-chart__legend-alert" aria-hidden="true">!</b> Alerte météo</span>
      </div>

      <div className="hourly-chart__body">
        <div className="hourly-chart__y-axis" aria-hidden="true">
          <span>100</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
          <span>0</span>
        </div>

        <div className="hourly-chart__viewport">
          <div className="hourly-chart__canvas" style={chartStyle}>
            <div className="hourly-chart__days" aria-label="Dates du graphique">
              {dayGroups.map((day) => (
                <span
                  key={day.key}
                  style={{ gridColumn: `span ${day.items.length}` }}
                  aria-label={day.label}
                >
                  {formatLocalDate(day.items[0].time, timeZone, "short")}
                </span>
              ))}
            </div>

            <div className="hourly-chart__plot">
              <div className="hourly-chart__grid" aria-hidden="true" />
              <div className="hourly-chart__hours">
                {hours.map((hour) => {
                  const score = hour.scores[sport];
                  const value = score.overall.score;
                  const selected = hour.time === selectedTime;
                  const best = hour.time === bestTime;
                  const alerts = score.weather.alerts.length;
                  /**
                   * Une variable par bouton relie la hauteur de barre à sa note sans calculer de pixels en JavaScript.
                   * Une note absente est représentée par un tiret, alors qu’une note 0 garde sa barre minimale et sa valeur.
                   */
                  const hourStyle = {
                    "--hour-score": `${value ?? 0}%`,
                  } as CSSProperties;
                  /**
                   * Le nom du bouton rassemble les informations qui ne doivent pas dépendre de la couleur ou des icônes.
                   * Les éléments graphiques correspondants sont masqués aux lecteurs d’écran pour éviter de répéter
                   * la même note, l’étoile et l’alerte au cours de la navigation.
                   */
                  const accessibleLabel = [
                    formatSlot(hour.time, hour.end_time, timeZone, "short"),
                    value === null
                      ? "note indisponible"
                      : `note ${value} sur 100, ${STATUS_LABELS[score.overall.status]}`,
                    best ? "meilleur créneau" : null,
                    alerts === 1
                      ? "une alerte météo"
                      : alerts > 1
                        ? `${alerts} alertes météo`
                        : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <button
                      className={`hourly-chart__hour hourly-chart__hour--${
                        STATUS_TONES[score.overall.status]
                      }${selected ? " is-selected" : ""}`}
                      key={hour.time}
                      type="button"
                      style={hourStyle}
                      onClick={() => onSelect(hour.time)}
                      aria-label={accessibleLabel}
                      aria-pressed={selected}
                    >
                      <span className="hourly-chart__bar-space" aria-hidden="true">
                        {value === null ? (
                          <span className="hourly-chart__missing">—</span>
                        ) : (
                          <>
                            <span className="hourly-chart__value">{value}</span>
                            <span className="hourly-chart__bar" />
                          </>
                        )}
                      </span>
                      <span className="hourly-chart__hour-label" aria-hidden="true">
                        <span>{formatLocalTime(hour.time, timeZone).replaceAll(" ", "")}</span>
                        <span className="hourly-chart__markers">
                          {best && <b className="hourly-chart__best">★</b>}
                          {alerts > 0 && <b className="hourly-chart__alert">!</b>}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="hourly-chart__x-axis">Heure locale</p>
          </div>
        </div>
      </div>

      <p className="hourly-chart__hint">Glissez pour comparer les heures</p>

      {selectedHour && selectedScore && (
        <div className="hourly-chart__selection" aria-live="polite">
          <div>
            <span>Créneau sélectionné</span>
            <strong>{formatSlot(selectedHour.time, selectedHour.end_time, timeZone)}</strong>
          </div>
          <div>
            <strong>
              {selectedScore.overall.score === null
                ? "Note indisponible"
                : `${selectedScore.overall.score} / 100`}
            </strong>
            <span>{STATUS_LABELS[selectedScore.overall.status]}</span>
          </div>
        </div>
      )}
    </div>
  );
}
