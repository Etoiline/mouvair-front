export type SportId = "easy_run" | "hard_run" | "cycling" | "walking";

export type ScoreStatus =
  | "favorable"
  | "correct"
  | "mitigé"
  | "défavorable"
  | "très défavorable"
  | "incomplet";

export type LegacyScoreStatus = Exclude<ScoreStatus, "très défavorable">;
export type ScoreFactorId = "air" | "temperature" | "rain" | "wind";
export type PollenId = "alder" | "birch" | "grass" | "mugwort" | "olive" | "ragweed";
export type ForecastDataState = "fresh" | "refresh_failed" | "stale";
export type AirQualityCategory =
  | "Bonne"
  | "Acceptable"
  | "Modérée"
  | "Mauvaise"
  | "Très mauvaise"
  | "Extrêmement mauvaise";

export type Location = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
  admin1: string | null;
  timezone: string | null;
};

export type ScoreFactor = {
  id: ScoreFactorId;
  label: string;
  score: number | null;
  value: number | null;
  unit: string;
};

export type AvailableScoreFactor = Omit<ScoreFactor, "score" | "value"> & {
  score: number;
  value: number;
};

export type ScoreSummary = {
  score: number | null;
  status: ScoreStatus;
};

export type WeatherScore = ScoreSummary & {
  factors: ScoreFactor[];
  reasons: string[];
  alerts: string[];
};

export type AirRecommendations = {
  general_population: string;
  sensitive_people: string;
};

export type AirScore = {
  score: number | null;
  aqi: number | null;
  category: AirQualityCategory | null;
  recommendations: AirRecommendations | null;
  reason: string | null;
};

export type SportScore = {
  sport: SportId;
  label: string;
  weather: WeatherScore;
  air: AirScore;
  overall: ScoreSummary;
  score: number | null;
  status: LegacyScoreStatus;
  factors: AvailableScoreFactor[];
  reasons: string[];
};

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

export type PollenForecast = Record<PollenId, number | null>;

export type ForecastHour = {
  time: string;
  end_time: string;
  conditions: Conditions;
  pollen: PollenForecast;
  scores: Record<SportId, SportScore>;
};

export type Forecast = {
  latitude: number;
  longitude: number;
  timezone: string;
  generated_at: string;
  hours: ForecastHour[];
  data_state: ForecastDataState;
  from_cache: boolean;
  recommendation_available: boolean;
};
