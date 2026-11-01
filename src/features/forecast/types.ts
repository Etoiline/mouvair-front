/**
 * Contrats de données reçus de l’API de prévisions.
 * Les noms et les valeurs d’état correspondent au backend ; ce fichier décrit les réponses sans
 * recalculer les notes. null signifie qu’une mesure ou une note manque et ne doit jamais devenir 0.
 */

/**
 * Identifiants techniques des quatre activités, utilisés comme clés dans les notes de chaque créneau.
 */
export type SportId = "easy_run" | "hard_run" | "cycling" | "walking";

/**
 * Qualification renvoyée avec la note météo ou globale.
 * Les libellés et les suffixes CSS correspondants sont centralisés dans lib/scorePresentation.ts.
 */
export type ScoreStatus =
  | "favorable"
  | "correct"
  | "mitigé"
  | "défavorable"
  | "très défavorable"
  | "incomplet";

/**
 * Clés des sous-notes météo ; elles permettent de retrouver un facteur sans dépendre de sa position.
 */
export type WeatherFactorId = "temperature" | "rain" | "wind";
/**
 * Espèces suivies dans le panneau pollen, avec une concentration distincte pour chacune.
 */
export type PollenId = "alder" | "birch" | "grass" | "mugwort" | "olive" | "ragweed";
/**
 * fresh : données réutilisables ; refresh_failed : données conservées après un échec de mise à jour ;
 * stale : données anciennes dont la recommandation peut être suspendue.
 */
export type ForecastDataState = "fresh" | "refresh_failed" | "stale";
/**
 * Catégories de l’AQI européen déjà déterminées par le backend.
 * Elles ne sont ni des pourcentages ni les statuts de la note globale.
 */
export type AirQualityCategory =
  | "Bonne"
  | "Acceptable"
  | "Modérée"
  | "Mauvaise"
  | "Très mauvaise"
  | "Extrêmement mauvaise";

/**
 * Détail d’un facteur météo : note sur 100, valeur utilisée et unité explicite.
 * La valeur du vent peut être un intermédiaire de calcul ; l’écran affiche donc les mesures de
 * Conditions pour le vent moyen et les rafales, tout en conservant la sous-note de ce facteur.
 */
export type ScoreFactor = {
  id: WeatherFactorId;
  label: string;
  score: number | null;
  value: number | null;
  unit: string;
};

/**
 * Note sur 100 et statut associé ; une note absente reste distincte d’une note défavorable égale à 0.
 */
export type ScoreSummary = {
  score: number | null;
  status: ScoreStatus;
};

/**
 * Résultat météo enrichi des facteurs, des explications et des alertes.
 * Les alertes restent présentées séparément des explications principales, même si celles-ci sont limitées.
 */
export type WeatherScore = ScoreSummary & {
  factors: ScoreFactor[];
  reasons: string[];
  alerts: string[];
};

/**
 * Messages destinés à deux publics différents ; ils sont affichés tels qu’ils sont fournis par l’API.
 */
export type AirRecommendations = {
  general_population: string;
  sensitive_people: string;
};

/**
 * Note Mouv’Air de qualité de l’air et indice AQI brut utilisés par deux présentations distinctes.
 * Les métadonnées peuvent manquer : l’interface prévoit un état de repli pour l’indice, la catégorie
 * et chaque recommandation au lieu d’inventer une valeur ou un conseil.
 */
export type AirScore = {
  score: number | null;
  aqi: number | null;
  category: AirQualityCategory | null;
  recommendations: AirRecommendations | null;
  reason: string | null;
};

/**
 * Ensemble des résultats pour une activité et un créneau.
 * weather, air et overall ont des responsabilités distinctes ; leurs notes ne se substituent pas
 * les unes aux autres lorsque l’une des sources est absente.
 */
export type SportScore = {
  // Le contrat reflète les trois sections imbriquées renvoyées par l’API.
  sport: SportId;
  label: string;
  weather: WeatherScore;
  air: AirScore;
  overall: ScoreSummary;
};

/**
 * Mesures météo brutes reçues pour le créneau : températures en °C, précipitations en mm,
 * vent et rafales en km/h, AQI européen sans unité. Les codes météo sont conservés dans le contrat
 * même lorsque le composant courant ne les présente pas directement.
 */
export type Conditions = {
  apparent_temperature: number | null;
  apparent_temperature_start: number | null;
  apparent_temperature_end: number | null;
  precipitation: number | null;
  wind_speed: number | null;
  wind_gusts: number | null;
  european_aqi: number | null;
  weather_code: number | null;
  weather_codes: Array<number | null>;
};

/**
 * Concentrations horaires en grains/m³ : 0 est une prévision disponible, null une donnée absente.
 */
export type PollenForecast = Record<PollenId, number | null>;

/**
 * Créneau délimité par deux horodatages ISO ; le fuseau d’affichage est porté par Forecast.
 * Le dictionnaire scores permet de changer d’activité sans demander de nouvelles prévisions.
 */
export type ForecastHour = {
  time: string;
  end_time: string;
  conditions: Conditions;
  pollen: PollenForecast;
  scores: Record<SportId, SportScore>;
};

/**
 * Réponse complète pour un lieu : créneaux, fuseau et métadonnées de récupération.
 * L’ordre des créneaux fourni par l’API sert aussi à départager les meilleurs scores ex æquo.
 */
export type Forecast = {
  latitude: number;
  longitude: number;
  timezone: string;
  /**
   * Horodatage utilisé pour annoncer l’heure de récupération et mesurer l’ancienneté des données.
   * Il ne doit pas être remplacé par l’heure du dernier contrôle local si une actualisation échoue.
   */
  generated_at: string;
  hours: ForecastHour[];
  data_state: ForecastDataState;
  /**
   * Indique l’origine de la réponse côté API ; le client ne déduit pas sa fraîcheur de ce seul booléen.
   */
  from_cache: boolean;
  /**
   * Autorise la mise en avant du meilleur créneau. Même si des notes existent encore,
   * une valeur false impose d’afficher la suspension plutôt qu’une recommandation active.
   */
  recommendation_available: boolean;
};
