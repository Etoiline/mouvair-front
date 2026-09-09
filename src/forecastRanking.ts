import type { ForecastHour, SportId } from "./types";

export function findBestHour(hours: ForecastHour[], sport: SportId): ForecastHour | null {
  return hours.reduce<ForecastHour | null>((best, hour) => {
    const score = hour.scores[sport].overall.score;
    if (score === null) return best;

    const bestScore = best?.scores[sport].overall.score;
    // L’ordre chronologique fourni par l’API départage les égalités en conservant le premier.
    return bestScore === null || bestScore === undefined || score > bestScore ? hour : best;
  }, null);
}

export function hasUnfavorableOverall(hour: ForecastHour, sport: SportId): boolean {
  const status = hour.scores[sport].overall.status;
  return status === "défavorable" || status === "très défavorable";
}
