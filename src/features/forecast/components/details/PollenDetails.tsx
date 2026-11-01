/**
 * Panneau informatif des concentrations horaires de pollen.
 * Ces mesures sont consultables avec le créneau mais ne participent pas aux notes Mouv’Air.
 * L’absence de toutes les espèces produit un message global ; une absence partielle reste indiquée espèce par espèce.
 */

import { formatPollenValue } from "../../lib/formatConditions";
import type { PollenForecast, PollenId } from "../../types";
import "./PollenDetails.css";

/**
 * Liste et ordre stables des six espèces du contrat API. Les identifiants accèdent aux valeurs,
 * alors que les noms français servent uniquement à la lecture dans les cartes.
 */
const POLLENS: { id: PollenId; label: string }[] = [
  { id: "alder", label: "Aulne" },
  { id: "birch", label: "Bouleau" },
  { id: "grass", label: "Graminées" },
  { id: "mugwort", label: "Armoise" },
  { id: "olive", label: "Olivier" },
  { id: "ragweed", label: "Ambroisie" },
];

/**
 * Présente les espèces disponibles et conserve les concentrations égales à zéro.
 * Les très petites valeurs positives sont formatées par formatPollenValue pour ne pas être assimilées
 * à une concentration 0. L’unité et la mention d’exclusion du score restent visibles dans ce panneau.
 */
export function PollenDetails({ pollen: pollenForecast }: { pollen: PollenForecast }) {
  // Une concentration égale à zéro est disponible, contrairement à null.
  const hasPollenData = POLLENS.some((pollen) => pollenForecast[pollen.id] !== null);

  return (
    <>
      {hasPollenData ? (
        <div className="pollen-grid">
          {POLLENS.map((pollen) => {
            const value = pollenForecast[pollen.id];
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
    </>
  );
}
