/**
 * Tests d’intégration du parcours principal, à côté du composant d’assemblage App.
 * Les vues et leurs hooks fonctionnent ensemble dans jsdom ; seuls les appels API sont simulés.
 * Les recherches par rôle et libellé vérifient ce qui est exposé à l’utilisateur plutôt que l’état
 * interne des composants. Les promesses contrôlées servent aux assertions pendant les chargements.
 */

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { getForecast } from "../features/forecast/api";
import { searchLocations } from "../features/locations/api";
import type { Forecast } from "../features/forecast/types";
import type { Location } from "../features/locations/types";
import { deferred, forecast, LOCATION, UPDATED_LOCATION } from "../test/fixtures";

/**
 * La simulation à la frontière API garde le parcours React réel tout en supprimant la dépendance au backend.
 */
vi.mock("../features/forecast/api", () => ({ getForecast: vi.fn() }));
vi.mock("../features/locations/api", () => ({ searchLocations: vi.fn() }));

const mockedGetForecast = vi.mocked(getForecast);
const mockedSearchLocations = vi.mocked(searchLocations);

/**
 * Prépare un scénario déjà arrivé au tableau de bord en empruntant le vrai formulaire de recherche.
 * La fonction attend le rendu des résultats puis celui des prévisions pour laisser chaque mise à jour
 * asynchrone se terminer, et retourne le même utilisateur simulé pour les actions suivantes.
 */
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
  /**
   * Réinitialise aussi les réponses programmées des mocks pour qu’aucun scénario ne dépende de leur ordre.
   */
  beforeEach(() => {
    vi.resetAllMocks();
  });

  /**
   * La temporisation de 400 ms dépasse le délai de recherche automatique de 350 ms.
   * L’absence d’un deuxième appel après ce délai prouve que la réécriture du nom choisi a été ignorée.
   */
  it("reporte la ville sélectionnée dans le champ sans relancer la recherche", async () => {
    const user = userEvent.setup();
    mockedSearchLocations.mockResolvedValueOnce([LOCATION]);
    mockedGetForecast.mockResolvedValueOnce(forecast([70]));
    render(<App />);

    const input = screen.getByLabelText("Votre ville") as HTMLInputElement;
    await user.type(input, "Lyo");
    await user.click(screen.getByRole("button", { name: "Voir les conditions" }));
    await user.click(await screen.findByRole("button", { name: /Lyon.*France/ }));

    expect(input.value).toBe("Lyon");
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    });
    expect(mockedSearchLocations).toHaveBeenCalledTimes(1);
  });

  /**
   * La deuxième réponse reste volontairement en attente pour observer le menu déjà ouvert.
   * Les assertions distinguent sa présence, l’inactivation des anciens choix et leur remplacement final.
   */
  it("conserve la liste ouverte sous un loader pendant la mise à jour des villes", async () => {
    const user = userEvent.setup();
    const updatedSearch = deferred<Location[]>();
    mockedSearchLocations
      .mockResolvedValueOnce([LOCATION])
      .mockReturnValueOnce(updatedSearch.promise);
    render(<App />);

    const input = screen.getByLabelText("Votre ville");
    await user.type(input, "Lyo");
    await user.click(screen.getByRole("button", { name: "Voir les conditions" }));
    await screen.findByRole("button", { name: /Lyon.*France/ });

    await user.type(input, "n");

    const results = screen.getByLabelText("Résultats de recherche");
    const previousResult = within(results).getByRole("button", { name: /Lyon.*France/ });
    expect(results.getAttribute("aria-busy")).toBe("true");
    expect((previousResult as HTMLButtonElement).disabled).toBe(true);
    expect(within(results).getByRole("status").textContent).toContain(
      "Mise à jour des résultats",
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    });
    expect(mockedSearchLocations).toHaveBeenCalledTimes(2);

    await act(async () => {
      updatedSearch.resolve([UPDATED_LOCATION]);
      await updatedSearch.promise;
    });

    expect(within(results).getByText(UPDATED_LOCATION.name)).toBeTruthy();
    expect(results.getAttribute("aria-busy")).toBe("false");
    expect(within(results).queryByRole("status")).toBeNull();
  });

  /**
   * Deux notes maximales identiques rendent observable la règle de départage chronologique.
   * Le clic sur une autre heure puis sur le récapitulatif vérifie que consultation et recommandation restent distinctes.
   */
  it("sélectionne un créneau et conserve le premier meilleur score en cas d’égalité", async () => {
    const user = await displayForecast(forecast([40, 90, 90]));
    const timeline = screen.getByRole("region", { name: "Heure par heure" });
    const hours = within(timeline).getAllByRole("button");

    expect(hours).toHaveLength(3);
    expect(hours[1].getAttribute("aria-label")).toContain("meilleur créneau");
    expect(hours[2].getAttribute("aria-label")).not.toContain("meilleur créneau");

    await user.click(hours[2]);
    expect(hours[2].getAttribute("aria-pressed")).toBe("true");

    const bestButton = screen
      .getByText("Meilleur créneau", { selector: ".best-slot > span" })
      .closest("button");
    if (bestButton === null) throw new Error("Bouton du meilleur créneau introuvable");
    await user.click(bestButton);
    expect(hours[1].getAttribute("aria-pressed")).toBe("true");
  });

  /**
   * Le scénario combine clic et flèche clavier pour vérifier à la fois le panneau actif et le focus.
   * Les recherches limitées au panneau actif évitent de confondre les contenus gardés montés pour la hauteur.
   */
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
    const airPanel = within(screen.getByRole("tabpanel", { name: "Qualité de l’air" }));
    expect(airPanel.getByText("AQI européen")).toBeTruthy();
    expect(airPanel.queryByText("indice", { exact: true })).toBeNull();
    expect(
      airPanel.queryByText("Indice de pollution sans unité : ce n’est pas un pourcentage."),
    ).toBeNull();

    await user.keyboard("{ArrowRight}");
    expect(pollenTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(pollenTab);
    expect(
      within(screen.getByRole("tabpanel", { name: "Pollens" })).getByText(
        "Prévisions de pollen indisponibles pour ce lieu ou ce créneau",
      ),
    ).toBeTruthy();
  });

  /**
   * La promesse différée permet d’assertir sur la note précédente pendant l’attente, puis sur la note
   * mise à jour après résolution. Une simple réponse instantanée ne vérifierait pas cette continuité.
   */
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

  /**
   * Le parcours repasse réellement par une nouvelle recherche et un chargement de prévisions.
   * Il protège le maintien du composant tableau de bord dans l’arbre, dont dépendent les préférences locales.
   */
  it("conserve l’activité et l’onglet de détail après une nouvelle recherche de ville", async () => {
    const user = await displayForecast(forecast([70]));
    await user.click(screen.getByRole("tab", { name: /Vélo$/ }));
    await user.click(screen.getByRole("tab", { name: "Pollens" }));
    mockedSearchLocations.mockResolvedValueOnce([UPDATED_LOCATION]);
    mockedGetForecast.mockResolvedValueOnce(forecast([85]));

    const input = screen.getByLabelText("Votre ville");
    await user.clear(input);
    await user.type(input, "Lyon 1er");
    await user.click(screen.getByRole("button", { name: "Voir les conditions" }));
    await user.click(await screen.findByRole("button", { name: /Lyon 1er Arrondissement.*France/ }));
    await screen.findByRole("heading", { name: "Vos conditions sur 24 h" });

    expect(screen.getByRole("tab", { name: /Vélo$/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Pollens" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel", { name: "Pollens" })).toBeTruthy();
  });

  /**
   * Un échec de mise à jour doit se traduire par un avertissement tout en laissant la note précédente
   * consultable ; cette branche diffère du premier chargement qui ne possède encore aucune donnée.
   */
  it("garde les données et signale une actualisation échouée", async () => {
    const user = await displayForecast(forecast([40, 60]));
    mockedGetForecast.mockRejectedValueOnce(new Error("Fournisseur indisponible"));

    await user.click(screen.getByRole("button", { name: "Actualiser" }));

    expect(await screen.findByText(/Actualisation impossible/)).toBeTruthy();
    expect(screen.getByLabelText("Note globale 40 sur 100")).toBeTruthy();
  });

  /**
   * Deux réponses successives, erreur puis succès, vérifient le nouvel essai sur le lieu déjà choisi.
   * Le nombre d’appels confirme que le bouton déclenche un chargement et ne relance pas le formulaire.
   */
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

  /**
   * L’indisponibilité de la recherche doit laisser le champ accessible pour qu’une nouvelle saisie reste possible.
   */
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
