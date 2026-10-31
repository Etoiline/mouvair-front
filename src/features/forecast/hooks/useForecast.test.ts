/**
 * Tests des effets temporels et de la concurrence de useForecast.
 * Le hook est monté sans ses vues pour contrôler directement ses états et ses actions.
 * L’horloge et la visibilité sont simulées ; les réponses API restent pilotées par le scénario.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deferred, forecast, LOCATION, UPDATED_LOCATION } from "../../../test/fixtures";
import { getForecast } from "../api";
import { REFRESH_INTERVAL_MS } from "../lib/refreshSchedule";
import type { Forecast } from "../types";
import { useForecast } from "./useForecast";

/**
 * Les données retournées sont des fixtures : la suite vérifie l’orchestration des requêtes, pas les fournisseurs météo.
 */
vi.mock("../api", () => ({ getForecast: vi.fn() }));

const mockedGetForecast = vi.mocked(getForecast);

describe("chargement et actualisation des prévisions", () => {
  /**
   * Un instant fixe évite de dépendre de l’heure du lancement des tests et rend les timers déterministes.
   * Le document est visible par défaut pour que les tests activent explicitement le cas de l’onglet masqué.
   */
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });

  /**
   * Restaure les accesseurs du document et l’horloge réelle pour isoler la suite des autres fichiers de tests.
   */
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  /**
   * La réponse initiale est résolue après resetForecast, ce qui reproduit un retour réseau devenu obsolète.
   * La vérification porte sur les données, le lieu et le loader : aucun de ces états ne doit être réactivé.
   */
  it("ignore un chargement terminé après le début d’une nouvelle recherche", async () => {
    const pending = deferred<Forecast>();
    mockedGetForecast.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(useForecast);

    let loading!: Promise<void>;
    act(() => { loading = result.current.loadForecast(LOCATION); });
    expect(result.current.loadingForecast).toBe(true);

    act(() => result.current.resetForecast());
    await act(async () => {
      pending.resolve(forecast([80]));
      await loading;
    });

    expect(result.current.forecast).toBeNull();
    expect(result.current.selectedLocation).toBeNull();
    expect(result.current.loadingForecast).toBe(false);
  });

  /**
   * L’actualisation de l’ancien lieu termine après le chargement du suivant.
   * Ce cas vérifie aussi que son bloc finally ne rétablit pas un état d’actualisation incohérent.
   */
  it("empêche une ancienne actualisation de remplacer les prévisions d’une autre ville", async () => {
    const pending = deferred<Forecast>();
    const nextForecast = forecast([90]);
    mockedGetForecast
      .mockResolvedValueOnce(forecast([40]))
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(nextForecast);
    const { result } = renderHook(useForecast);
    await act(() => result.current.loadForecast(LOCATION));

    let refreshing!: Promise<void>;
    act(() => { refreshing = result.current.refreshForecast(); });
    await act(() => result.current.loadForecast(UPDATED_LOCATION));
    await act(async () => {
      pending.resolve(forecast([10]));
      await refreshing;
    });

    expect(result.current.selectedLocation).toEqual(UPDATED_LOCATION);
    expect(result.current.forecast).toEqual(nextForecast);
    expect(result.current.refreshing).toBe(false);
  });

  /**
   * L’horloge traverse la limite des quinze minutes pendant que le document est masqué.
   * L’événement visibilitychange doit rattraper cette échéance avec un seul appel supplémentaire.
   */
  it("rattrape au retour sur la page un contrôle manqué pendant que l’onglet était masqué", async () => {
    mockedGetForecast.mockResolvedValueOnce(forecast([40]));
    const visibility = vi.spyOn(document, "visibilityState", "get");
    const { result } = renderHook(useForecast);
    await act(() => result.current.loadForecast(LOCATION));

    visibility.mockReturnValue("hidden");
    await act(() => vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS));
    expect(mockedGetForecast).toHaveBeenCalledTimes(1);

    const updated = forecast([85]);
    mockedGetForecast.mockResolvedValueOnce(updated);
    visibility.mockReturnValue("visible");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });

    expect(mockedGetForecast).toHaveBeenCalledTimes(2);
    expect(result.current.forecast).toEqual(updated);
  });

  /**
   * Une frontière proche de trente secondes isole le timer de début de créneau du contrôle périodique.
   * La seconde de marge fait déclencher la récupération au bout de trente et une secondes.
   */
  it("actualise les prévisions au début du prochain créneau", async () => {
    const initial = forecast([40]);
    const updated = forecast([85]);
    initial.hours[0].time = new Date(Date.now() + 30_000).toISOString();
    mockedGetForecast.mockResolvedValueOnce(initial).mockResolvedValueOnce(updated);
    const { result } = renderHook(useForecast);
    await act(() => result.current.loadForecast(LOCATION));

    await act(() => vi.advanceTimersByTimeAsync(31_000));

    expect(mockedGetForecast).toHaveBeenCalledTimes(2);
    expect(result.current.forecast).toEqual(updated);
  });

  /**
   * Des données récupérées depuis plus d’une heure doivent rester lisibles après un échec,
   * mais leur état et le booléen de recommandation doivent empêcher la mise en avant d’une meilleure option.
   */
  it("suspend le meilleur créneau si une actualisation échoue avec des données trop anciennes", async () => {
    const initial = forecast([40], new Date(Date.now() - 61 * 60 * 1000));
    mockedGetForecast
      .mockResolvedValueOnce(initial)
      .mockRejectedValueOnce(new Error("Service indisponible"));
    const { result } = renderHook(useForecast);
    await act(() => result.current.loadForecast(LOCATION));
    await act(() => result.current.refreshForecast());

    expect(result.current.forecast?.hours).toEqual(initial.hours);
    expect(result.current.forecast?.data_state).toBe("stale");
    expect(result.current.forecast?.recommendation_available).toBe(false);
  });

  /**
   * Le démontage est suivi d’une avance de temps et d’un événement de visibilité.
   * L’absence de nouvel appel et de timer résiduel vérifie le nettoyage des deux modes d’actualisation.
   */
  it("retire les contrôles automatiques lorsque l’écran est démonté", async () => {
    mockedGetForecast.mockResolvedValueOnce(forecast([70]));
    const { result, unmount } = renderHook(useForecast);
    await act(() => result.current.loadForecast(LOCATION));

    unmount();
    await act(() => vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_MS));
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });

    expect(vi.getTimerCount()).toBe(0);
    expect(mockedGetForecast).toHaveBeenCalledTimes(1);
  });
});
