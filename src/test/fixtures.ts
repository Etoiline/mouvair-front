/**
 * Données synthétiques partagées par les tests de parcours et de hooks.
 * Les structures respectent les contrats de l’API mais simplifient volontairement les valeurs : elles
 * ne cherchent pas à reproduire le calcul météo ou AQI du backend. Aucun appel réseau n’est effectué ici.
 */

import type { Forecast, ForecastHour, ScoreStatus, SportId, SportScore } from "../features/forecast/types";
import type { Location } from "../features/locations/types";

/**
 * Lieu de référence complet pour vérifier les libellés, la sélection et les paramètres de chargement.
 */
export const LOCATION: Location = {
  id: 1,
  name: "Lyon",
  latitude: 45.75,
  longitude: 4.85,
  country: "France",
  admin1: "Auvergne-Rhône-Alpes",
  timezone: "Europe/Paris",
};

/**
 * Deuxième résultat partageant les coordonnées du lieu de référence mais ayant un autre nom et identifiant.
 * Il permet d’observer le remplacement d’une liste et le changement de ville sans modifier le reste des données.
 */
export const UPDATED_LOCATION: Location = {
  ...LOCATION,
  id: 2,
  name: "Lyon 1er Arrondissement",
};

const SPORTS: SportId[] = ["easy_run", "hard_run", "cycling", "walking"];
const SPORT_LABELS: Record<SportId, string> = {
  easy_run: "Course tranquille",
  hard_run: "Course intense",
  cycling: "Vélo",
  walking: "Marche",
};

/**
 * Qualification simplifiée réservée aux scénarios d’interface.
 * Les seuils utiles aux assertions ne constituent pas une deuxième implémentation des règles métier.
 */
function scoreStatus(score: number | null): ScoreStatus {
  if (score === null) return "incomplet";
  if (score >= 80) return "favorable";
  if (score >= 60) return "correct";
  return "mitigé";
}

/**
 * Construit les trois sections de score et les messages attendus par les vues.
 * La même note est utilisée pour météo, air et global afin que le scénario contrôle facilement
 * la valeur observée ; les sous-notes conservent malgré tout la forme complète du contrat.
 */
function sportScore(sport: SportId, score: number | null): SportScore {
  const status = scoreStatus(score);
  return {
    sport,
    label: SPORT_LABELS[sport],
    weather: {
      score,
      status,
      factors: [
        {
          id: "temperature",
          label: "Température ressentie",
          score,
          value: 18,
          unit: "°C",
        },
        { id: "rain", label: "Précipitations", score, value: 0, unit: "mm" },
        { id: "wind", label: "Vent", score, value: 8, unit: "km/h" },
      ],
      reasons: ["Conditions météo de test"],
      alerts: [],
    },
    air: {
      score,
      aqi: score === null ? null : 22,
      category: score === null ? null : "Bonne",
      recommendations:
        score === null
          ? null
          : {
              general_population: "Conditions habituelles.",
              sensitive_people: "Conditions habituelles.",
            },
      reason: score === null ? null : "Air de bonne qualité",
    },
    overall: { score, status },
  };
}

/**
 * Crée un créneau d’une heure avec des mesures connues et aucun pollen disponible par défaut.
 * Malgré le nom easyRunScore, la valeur est réutilisée pour les quatre activités : les tests de
 * sélection d’activité vérifient ici le comportement de l’interface, pas un classement sportif réel.
 */
function forecastHour(start: Date, easyRunScore: number | null): ForecastHour {
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    time: start.toISOString(),
    end_time: end.toISOString(),
    conditions: {
      apparent_temperature: 18,
      apparent_temperature_start: 17,
      apparent_temperature_end: 18,
      precipitation: 0,
      wind_speed: 8,
      wind_gusts: 12,
      european_aqi: 22,
      weather_code: 0,
      weather_codes: [0, 0],
    },
    pollen: {
      alder: null,
      birch: null,
      grass: null,
      mugwort: null,
      olive: null,
      ragweed: null,
    },
    scores: Object.fromEntries(
      SPORTS.map((sport) => [sport, sportScore(sport, easyRunScore)]),
    ) as Record<SportId, SportScore>,
  };
}

/**
 * Crée autant de créneaux que de scores fournis, avec une date de récupération personnalisable.
 * Le premier créneau est positionné dans le futur pour éviter un contrôle de frontière immédiat.
 * Le fuseau UTC et les minutes remises à zéro rendent les horaires faciles à comparer dans les tests.
 */
export function forecast(scores: Array<number | null>, generatedAt = new Date()): Forecast {
  const firstStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
  firstStart.setUTCMinutes(0, 0, 0);
  return {
    latitude: LOCATION.latitude,
    longitude: LOCATION.longitude,
    timezone: "UTC",
    generated_at: generatedAt.toISOString(),
    hours: scores.map((score, index) =>
      forecastHour(new Date(firstStart.getTime() + index * 60 * 60 * 1000), score),
    ),
    data_state: "fresh",
    from_cache: false,
    recommendation_available: true,
  };
}

/**
 * Expose une promesse et ses commandes de résolution/rejet au scénario de test.
 * Le test peut ainsi vérifier l’écran pendant l’attente, inverser l’ordre d’arrivée de deux réponses,
 * puis laisser React appliquer la réponse dans un bloc act explicitement contrôlé.
 */
export function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}
