/**
 * Panneau de qualité de l’air centré sur l’indice européen brut.
 * L’AQI est affiché sans unité et reste distinct de la note Mouv’Air sur 100 présentée dans ScoreCard.
 * Les conseils sont reçus du backend et gardent une présentation séparée pour chaque public.
 */

import { DECIMAL_FORMATTER } from "../../lib/formatConditions";
import type { AirQualityCategory, AirScore } from "../../types";
import "./AirQualityDetails.css";

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

/**
 * Remplace le panneau chiffré par un état explicite lorsque l’AQI est absent.
 * Avec un indice disponible, la catégorie pilote uniquement son badge ; une catégorie ou une
 * recommandation manquante reçoit son propre libellé de repli, sans être déduite d’un seuil local.
 */
export function AirQualityDetails({ air }: { air: AirScore }) {
  return air.aqi === null ? (
    <div className="air-details__unavailable" role="status">
      <strong>Qualité de l’air indisponible</strong>
      <p>L’indice AQI européen n’est pas disponible pour ce créneau.</p>
    </div>
  ) : (
    <div className="air-details__content">
      <div className="air-index">
        <p>AQI européen</p>
        <div className="air-index__value">
          <strong>{DECIMAL_FORMATTER.format(air.aqi)}</strong>
        </div>
        {air.category ? (
          <span className={`air-category air-category--${AIR_CATEGORY_TONES[air.category]}`}>
            {air.category}
          </span>
        ) : (
          <span className="air-category air-category--missing">
            Catégorie indisponible
          </span>
        )}
      </div>

      <div className="air-recommendations">
        <article>
          <span>Population générale</span>
          <p>
            {air.recommendations?.general_population ?? "Recommandation indisponible."}
          </p>
        </article>
        <article>
          <span>Personnes sensibles</span>
          <p>
            {air.recommendations?.sensitive_people ?? "Recommandation indisponible."}
          </p>
        </article>
      </div>
    </div>
  );
}
