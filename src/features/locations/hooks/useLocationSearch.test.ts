/**
 * Tests de concurrence et de nettoyage de la recherche automatique.
 * Le temps simulé permet de franchir précisément le délai de 350 ms sans attente réelle.
 * Les promesses différées permettent d’observer une réponse tardive même après l’annulation du signal.
 */

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deferred, LOCATION, UPDATED_LOCATION } from "../../../test/fixtures";
import { searchLocations } from "../api";
import type { Location } from "../types";
import { useLocationSearch } from "./useLocationSearch";

vi.mock("../api", () => ({ searchLocations: vi.fn() }));

const mockedSearchLocations = vi.mocked(searchLocations);

describe("recherche automatique des villes", () => {
  /**
   * Chaque scénario repart de mocks vides et d’une horloge contrôlée, sans appels réellement envoyés à l’API.
   */
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  /**
   * Rend le contrôle des timers au navigateur simulé après chaque scénario pour ne pas affecter les autres tests.
   */
  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * L’ancienne promesse est résolue après la nouvelle frappe mais avant la prochaine requête.
   * Le signal doit être annulé immédiatement et le résultat ignoré, tandis que le menu reste en attente
   * du bon résultat pendant la temporisation puis pendant sa récupération.
   */
  it("annule la requête précédente dès la saisie suivante et ignore sa réponse tardive", async () => {
    const previous = deferred<Location[]>();
    const next = deferred<Location[]>();
    const onSearchStart = vi.fn();
    mockedSearchLocations.mockReturnValueOnce(previous.promise).mockReturnValueOnce(next.promise);
    const { result } = renderHook(() => useLocationSearch(onSearchStart));

    act(() => result.current.setQuery("Lyo"));
    await act(() => vi.advanceTimersByTimeAsync(350));
    const previousSignal = mockedSearchLocations.mock.calls[0][1];

    act(() => result.current.setQuery("Lyon"));
    expect(previousSignal?.aborted).toBe(true);
    await act(async () => {
      previous.resolve([LOCATION]);
      await previous.promise;
    });
    expect(result.current.locations).toEqual([]);
    expect(result.current.locationResultsPending).toBe(true);

    await act(() => vi.advanceTimersByTimeAsync(350));
    await act(async () => {
      next.resolve([UPDATED_LOCATION]);
      await next.promise;
    });

    expect(result.current.locations).toEqual([UPDATED_LOCATION]);
    expect(result.current.locationResultsPending).toBe(false);
    expect(onSearchStart).toHaveBeenCalledTimes(2);
  });

  /**
   * Une promesse qui reste en attente rend observable l’annulation au démontage.
   * Le signal et le nombre de timers restants vérifient le nettoyage sans dépendre d’une réponse réseau.
   */
  it("annule une recherche en cours lorsque le champ est démonté", async () => {
    mockedSearchLocations.mockReturnValueOnce(new Promise<Location[]>(() => {}));
    const onSearchStart = vi.fn();
    const { result, unmount } = renderHook(() => useLocationSearch(onSearchStart));
    act(() => result.current.setQuery("Lyon"));
    await act(() => vi.advanceTimersByTimeAsync(350));
    const signal = mockedSearchLocations.mock.calls[0][1];

    unmount();

    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
