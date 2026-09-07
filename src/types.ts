export type SportId = "easy_run" | "hard_run" | "cycling" | "walking";

export type Location = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  timezone?: string;
};

export type ScoreFactor = {
  id: "air" | "temperature" | "rain" | "wind";
  label: string;
  score: number;
  value: number;
  unit: string;
};

export type SportScore = {
  sport: SportId;
  label: string;
  score: number | null;
  status: "favorable" | "correct" | "mitigé" | "défavorable" | "incomplet";
  factors: ScoreFactor[];
  reasons: string[];
};

export type Conditions = {
  apparent_temperature: number;
  precipitation: number;
  wind_speed: number;
  wind_gusts: number;
  european_aqi: number;
  weather_code: number;
};

export type ForecastHour = {
  time: string;
  conditions: Conditions;
  scores: Record<SportId, SportScore>;
};

export type Forecast = {
  latitude: number;
  longitude: number;
  timezone: string;
  generated_at: string;
  hours: ForecastHour[];
};

