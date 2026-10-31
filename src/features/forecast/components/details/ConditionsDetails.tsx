/**
 * Conteneur des trois panneaux de détail : météo, qualité de l’air et pollens.
 * L’onglet est contrôlé par ForecastDashboard pour survivre à un changement de ville. Les panneaux
 * restent rendus dans la même cellule de grille : le plus haut réserve la hauteur de la carte, même inactif.
 */

import type { KeyboardEvent } from "react";

import type { ForecastHour, SportScore } from "../../types";
import { AirQualityDetails } from "./AirQualityDetails";
import { PollenDetails } from "./PollenDetails";
import { WeatherDetails } from "./WeatherDetails";
import "./ConditionsDetails.css";

/**
 * Identifiants utilisés à la fois pour l’état de sélection et pour relier les onglets à leurs panneaux.
 */
export type DetailTabId = "weather" | "air" | "pollen";

/**
 * Ordre commun à la navigation clavier et à l’affichage. La description active complète l’en-tête
 * sans changer l’identité du panneau ni demander de nouvelles données.
 */
const DETAIL_TABS: { id: DetailTabId; label: string; description: string }[] = [
  {
    id: "weather",
    label: "Météo",
    description: "Conditions retenues pour ce créneau de 1 h",
  },
  {
    id: "air",
    label: "Qualité de l’air",
    description: "Indice européen de qualité de l’air",
  },
  {
    id: "pollen",
    label: "Pollens",
    description: "Concentrations horaires en grains/m³",
  },
];

/**
 * Le créneau et son score proviennent d’une sélection commune dans le parent.
 * Le composant ne conserve pas une copie des données ni de l’onglet, afin d’éviter leur désynchronisation.
 */
type ConditionsDetailsProps = {
  hour: ForecastHour;
  score: SportScore;
  detailTab: DetailTabId;
  onTabChange: (tab: DetailTabId) => void;
};

/**
 * Relie chaque bouton à son panneau avec aria-controls et aria-labelledby.
 * Seul l’onglet actif et son panneau entrent dans l’ordre de tabulation. Les autres panneaux combinent
 * aria-hidden, inert et la visibilité CSS : leur place reste réservée sans exposer leur contenu
 * aux lecteurs d’écran ni permettre d’y placer le focus.
 */
export function ConditionsDetails({
  hour,
  score,
  detailTab,
  onTabChange,
}: ConditionsDetailsProps) {
  const selectedDetailTab = DETAIL_TABS.find((tab) => tab.id === detailTab) ?? DETAIL_TABS[0];

  /**
   * Applique une navigation circulaire avec les flèches, et un accès direct avec Home et End.
   * La sélection et le focus sont déplacés ensemble pour que le clavier suive le panneau affiché.
   * Les autres touches conservent leur comportement normal ; preventDefault ne concerne que les touches gérées.
   */
  function handleDetailTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentTab: DetailTabId,
  ) {
    const currentIndex = DETAIL_TABS.findIndex((item) => item.id === currentTab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % DETAIL_TABS.length;
    if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + DETAIL_TABS.length) % DETAIL_TABS.length;
    }
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = DETAIL_TABS.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = DETAIL_TABS[nextIndex];
    onTabChange(nextTab.id);
    document.getElementById(`conditions-details-tab-${nextTab.id}`)?.focus();
  }

  return (
    <section className="conditions-details" aria-labelledby="conditions-details-title">
      <header className="conditions-details__header">
        <div>
          <p className="eyebrow">Détail du créneau</p>
          <h3 id="conditions-details-title">Conditions détaillées</h3>
        </div>
        <p>{selectedDetailTab.description}</p>
      </header>

      <div
        className="conditions-details__tabs"
        role="tablist"
        aria-label="Choisir le détail du créneau"
      >
        {DETAIL_TABS.map((item) => (
          <button
            className="conditions-details__tab"
            id={`conditions-details-tab-${item.id}`}
            key={item.id}
            type="button"
            role="tab"
            aria-controls={`conditions-details-panel-${item.id}`}
            aria-selected={detailTab === item.id}
            tabIndex={detailTab === item.id ? 0 : -1}
            onClick={() => onTabChange(item.id)}
            onKeyDown={(event) => handleDetailTabKeyDown(event, item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        className={`conditions-details__panel${
          detailTab === "weather" ? "" : " conditions-details__panel--inactive"
        }`}
        id="conditions-details-panel-weather"
        role="tabpanel"
        aria-labelledby="conditions-details-tab-weather"
        aria-hidden={detailTab !== "weather"}
        inert={detailTab !== "weather"}
        tabIndex={detailTab === "weather" ? 0 : -1}
      >
        <WeatherDetails hour={hour} score={score} />
      </div>

      <div
        className={`conditions-details__panel${
          detailTab === "air" ? "" : " conditions-details__panel--inactive"
        }`}
        id="conditions-details-panel-air"
        role="tabpanel"
        aria-labelledby="conditions-details-tab-air"
        aria-hidden={detailTab !== "air"}
        inert={detailTab !== "air"}
        tabIndex={detailTab === "air" ? 0 : -1}
      >
        <AirQualityDetails air={score.air} />
      </div>

      <div
        className={`conditions-details__panel${
          detailTab === "pollen" ? "" : " conditions-details__panel--inactive"
        }`}
        id="conditions-details-panel-pollen"
        role="tabpanel"
        aria-labelledby="conditions-details-tab-pollen"
        aria-hidden={detailTab !== "pollen"}
        inert={detailTab !== "pollen"}
        tabIndex={detailTab === "pollen" ? 0 : -1}
      >
        <PollenDetails pollen={hour.pollen} />
      </div>
    </section>
  );
}
