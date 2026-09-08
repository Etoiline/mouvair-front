# Changelog

- Replace the legacy factor card with a selected-slot summary that separates overall, weather, and air scores, preserves partial results, and surfaces weather alerts and primary explanations.

- Refresh visible forecasts automatically every 15 minutes and when the current hourly window expires, catch up after returning to the page, and prevent duplicate or looping requests.

- Add non-blocking manual forecast refresh, show the real retrieval time and failure or stale-data notices, preserve displayed results, and suspend outdated recommendations.

- Preserve the selected forecast time across activity and data changes, fall back safely when it disappears, and select the earliest valid overall-score recommendation.

- Display complete local forecast intervals across the dashboard, identify the city timezone, and distinguish repeated hours during daylight-saving transitions.

- Align the TypeScript forecast contract with nested weather, air, and overall scores, nullable conditions, pollen data, hourly bounds, and cache freshness metadata.

## 0.2.0 - 2026-09-08

- Add an interactive release script that requires a clean repository and pending changelog entries, updates the package version, dates the release, and creates the gitmoji release commit.
- Add shared agent instructions for French code documentation and the validation, changelog, and gitmoji commit workflow.
- Initialize the changelog from the existing frontend implementation.

## 0.1.0 - 2026-09-07

- Initialize the React, TypeScript, and Vite frontend with pnpm scripts and a configurable backend API URL.
- Add city search and location selection with loading, empty-result, and API error messages in French.
- Display hourly forecasts for easy running, intense running, cycling, and walking.
- Show the selected hour's score, condition status, explanations, and air quality, temperature, precipitation, and wind factor details.
- Add an hourly timeline and a shortcut to the highest-scoring available hour for the selected activity.
- Add Mouv’Air branding, forecast source attribution, and the outdoor-conditions disclaimer.
