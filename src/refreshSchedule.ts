import type { ForecastDataState } from "./types";

export const REFRESH_INTERVAL_MS = 15 * 60 * 1000;
const HOUR_BOUNDARY_DELAY_MS = 1000;

export function periodicRefreshDelay(lastCheckAt: number, now: number): number {
  return Math.max(lastCheckAt + REFRESH_INTERVAL_MS - now, 0);
}

export function boundaryRefreshDelay(
  firstStartValue: string,
  lastCheckAt: number | null,
  now: number,
): number | null {
  const firstStart = Date.parse(firstStartValue);
  if (!Number.isFinite(firstStart)) return null;
  if (firstStart < now) {
    return lastCheckAt === null || lastCheckAt <= firstStart ? 0 : null;
  }
  return firstStart + HOUR_BOUNDARY_DELAY_MS - now;
}

export function shouldRefreshWhenVisible(
  firstStartValue: string,
  generatedAtValue: string,
  dataState: ForecastDataState,
  lastCheckAt: number | null,
  now: number,
): boolean {
  const firstStart = Date.parse(firstStartValue);
  const retrievedAt = Date.parse(generatedAtValue);
  const checkIsDue = lastCheckAt === null || now - lastCheckAt >= REFRESH_INTERVAL_MS;
  const boundaryIsDue =
    Number.isFinite(firstStart) &&
    firstStart < now &&
    (lastCheckAt === null || lastCheckAt <= firstStart);
  const freshCacheExpired =
    dataState === "fresh" &&
    (!Number.isFinite(retrievedAt) || now - retrievedAt > REFRESH_INTERVAL_MS);
  return checkIsDue || boundaryIsDue || freshCacheExpired;
}
