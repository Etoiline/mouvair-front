# Changelog

- Consolidate weather, air-quality, and pollen details into one accessible tabbed card.

- Improve the city-search submit button contrast on its lime background.

- Ensure city names remain readable against the white location-results background.

- Trigger city searches automatically after three characters with debouncing, request cancellation, and an immediate submit fallback.

- Add Vitest and Testing Library coverage for slot selection, best-slot ranking, refresh behavior, retries, and search errors.

- Require three characters for city searches to align the interface with the Redis-protected geocoding contract.

## 0.3.0 - 2026-09-09

- Remove deprecated flat sport-score compatibility types and align the client contract exclusively with nested weather, air, and overall sections.

- Separate location search from initial forecast loading, show city-specific progress, and provide an in-place retry after first-load failures while keeping search accessible.

- Mark and link the best complete slot, preserve the earliest tie, warn when its conditions are unfavorable, and distinguish suspended recommendations from forecasts with no complete slot.

- Replace the horizontal hourly carousel with responsive date-grouped slot cards showing local intervals, overall scores and statuses, incomplete states, alerts, and selection.

- Add selected-slot pollen forecasts for six types, preserve zero concentrations, distinguish missing values, and clarify that pollen does not affect scores.

- Add selected-slot European AQI details with its category, separate guidance for general and sensitive people, and an explicit unavailable state.

- Add selected-slot weather details with apparent temperature, hourly precipitation, actual wind and gust values, factor scores, and explicit unavailable states.

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
