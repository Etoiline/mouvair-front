import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { getForecast, searchLocations } from "./api";
import type {
  Forecast,
  ForecastHour,
  Location,
  ScoreStatus,
  SportId,
  SportScore,
} from "./types";

vi.mock("./api", () => ({
  getForecast: vi.fn(),
  searchLocations: vi.fn(),
}));

const mockedGetForecast = vi.mocked(getForecast);
const mockedSearchLocations = vi.mocked(searchLocations);

const LOCATION: Location = {
  id: 1,
  name: "Lyon",
  latitude: 45.75,
  longitude: 4.85,
  country: "France",
  admin1: "Auvergne-Rhône-Alpes",
  timezone: "Europe/Paris",
};

const SPORTS: SportId[] = ["easy_run", "hard_run", "cycling", "walking"];
const SPORT_LABELS: Record<SportId, string> = {
  easy_run: "Course tranquille",
  hard_run: "Course intense",
  cycling: "Vélo",
  walking: "Marche",
};

function scoreStatus(score: number | null): ScoreStatus {
  if (score === null) return "incomplet";
  if (score >= 80) return "favorable";
  if (score >= 60) return "correct";
  return "mitigé";
}

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

function forecast(scores: Array<number | null>, generatedAt = new Date()): Forecast {
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

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function displayForecast(value: Forecast) {
  const user = userEvent.setup();
  mockedSearchLocations.mockResolvedValueOnce([LOCATION]);
  mockedGetForecast.mockResolvedValueOnce(value);
  render(<App />);

  await user.type(screen.getByLabelText("Votre ville"), "Lyon");
  await user.click(screen.getByRole("button", { name: "Voir les conditions" }));
  await user.click(await screen.findByRole("button", { name: /Lyon.*France/ }));
  await screen.findByRole("heading", { name: "Vos conditions sur 24 h" });
  return user;
}

describe("parcours principal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sélectionne un créneau et conserve le premier meilleur score en cas d’égalité", async () => {
    const user = await displayForecast(forecast([40, 90, 90]));
    const timeline = screen.getByRole("region", { name: "Heure par heure" });
    const cards = within(timeline).getAllByRole("button");

    expect(within(cards[1]).getByText("Meilleur créneau")).toBeTruthy();
    expect(within(cards[2]).queryByText("Meilleur créneau")).toBeNull();

    await user.click(cards[2]);
    expect(within(cards[2]).getByText("Sélectionné")).toBeTruthy();

    const bestButton = screen
      .getByText("Meilleur créneau", { selector: ".best-slot > span" })
      .closest("button");
    if (bestButton === null) throw new Error("Bouton du meilleur créneau introuvable");
    await user.click(bestButton);
    expect(within(cards[1]).getByText("Sélectionné")).toBeTruthy();
  });

  it("regroupe les détails du créneau dans trois onglets navigables", async () => {
    const user = await displayForecast(forecast([70]));
    expect(screen.getAllByRole("region", { name: "Conditions détaillées" })).toHaveLength(1);
    const tablist = screen.getByRole("tablist", { name: "Choisir le détail du créneau" });
    const weatherTab = within(tablist).getByRole("tab", { name: "Météo" });
    const airTab = within(tablist).getByRole("tab", { name: "Qualité de l’air" });
    const pollenTab = within(tablist).getByRole("tab", { name: "Pollens" });

    expect(weatherTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel", { name: "Météo" })).toBeTruthy();

    await user.click(airTab);
    expect(airTab.getAttribute("aria-selected")).toBe("true");
    expect(
      within(screen.getByRole("tabpanel", { name: "Qualité de l’air" })).getByText(
        "AQI européen",
      ),
    ).toBeTruthy();

    await user.keyboard("{ArrowRight}");
    expect(pollenTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(pollenTab);
    expect(
      within(screen.getByRole("tabpanel", { name: "Pollens" })).getByText(
        "Prévisions de pollen indisponibles pour ce lieu ou ce créneau",
      ),
    ).toBeTruthy();
  });

  it("conserve les résultats visibles pendant une actualisation réussie", async () => {
    const user = await displayForecast(forecast([40, 60]));
    const nextForecast = deferred<Forecast>();
    mockedGetForecast.mockReturnValueOnce(nextForecast.promise);

    await user.click(screen.getByRole("button", { name: "Actualiser" }));

    expect(screen.getByRole("button", { name: "Actualisation…" })).toBeTruthy();
    expect(screen.getByLabelText("Note globale 40 sur 100")).toBeTruthy();

    await act(async () => {
      nextForecast.resolve(forecast([85, 70]));
      await nextForecast.promise;
    });

    expect(await screen.findByLabelText("Note globale 85 sur 100")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Actualiser" })).toBeTruthy();
  });

  it("garde les données et signale une actualisation échouée", async () => {
    const user = await displayForecast(forecast([40, 60]));
    mockedGetForecast.mockRejectedValueOnce(new Error("Fournisseur indisponible"));

    await user.click(screen.getByRole("button", { name: "Actualiser" }));

    expect(await screen.findByText(/Actualisation impossible/)).toBeTruthy();
    expect(screen.getByLabelText("Note globale 40 sur 100")).toBeTruthy();
  });

  it("permet de réessayer après l’échec du premier chargement", async () => {
    const user = userEvent.setup();
    mockedSearchLocations.mockResolvedValueOnce([LOCATION]);
    mockedGetForecast
      .mockRejectedValueOnce(new Error("Prévisions indisponibles"))
      .mockResolvedValueOnce(forecast([70, 80]));
    render(<App />);

    await user.type(screen.getByLabelText("Votre ville"), "Lyon");
    await user.click(screen.getByRole("button", { name: "Voir les conditions" }));
    await user.click(await screen.findByRole("button", { name: /Lyon.*France/ }));

    const error = await screen.findByRole("alert");
    expect(within(error).getByText("Prévisions indisponibles")).toBeTruthy();
    await user.click(within(error).getByRole("button", { name: "Réessayer" }));

    expect(
      await screen.findByRole("heading", { name: "Vos conditions sur 24 h" }),
    ).toBeTruthy();
    expect(mockedGetForecast).toHaveBeenCalledTimes(2);
  });

  it("affiche une erreur de recherche sans masquer le formulaire", async () => {
    const user = userEvent.setup();
    mockedSearchLocations.mockRejectedValueOnce(new Error("Recherche indisponible"));
    render(<App />);

    await user.type(screen.getByLabelText("Votre ville"), "Lyon");
    await user.click(screen.getByRole("button", { name: "Voir les conditions" }));

    expect(await screen.findByText("Recherche indisponible")).toBeTruthy();
    expect(screen.getByLabelText("Votre ville")).toBeTruthy();
  });
});
