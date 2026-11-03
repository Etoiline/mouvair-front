/**
 * Cycle de vie des prévisions pour la ville choisie.
 * Ce hook distingue le premier chargement, qui remplace les données, d’une actualisation, qui garde
 * les résultats visibles. Il coordonne aussi les contrôles périodiques et le retour sur un onglet visible.
 * Les identifiants de requête empêchent une ancienne réponse de réécrire l’état d’une nouvelle ville.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { Location } from "../../locations/types";
import { getForecast } from "../api";
import {
  boundaryRefreshDelay,
  periodicRefreshDelay,
  shouldRefreshWhenVisible,
} from "../lib/refreshSchedule";
import type { Forecast } from "../types";

/**
 * Ancienneté maximale retenue après un échec de récupération avant de suspendre la recommandation.
 */
const STALE_AFTER_MS = 60 * 60 * 1000;

/**
 * Expose les données et les actions du parcours de prévisions sans dépendre de ses composants.
 * L’erreur initiale est affichable avec un nouvel essai ; l’erreur d’actualisation est portée par
 * forecast.data_state afin que les données déjà disponibles restent consultables.
 */
export function useForecast() {
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  /**
   * Date de fin du dernier contrôle local, distincte de forecast.generated_at qui mesure l’âge des données.
   * Un échec d’actualisation met aussi cette date à jour pour espacer les vérifications périodiques.
   */
  const [lastCheckAt, setLastCheckAt] = useState<number | null>(null);
  const [forecastError, setForecastError] = useState<string | null>(null);
  /**
   * Compteur de génération partagé par chargement et actualisation. Toute réponse compare son numéro
   * au numéro courant avant de modifier l’état, même lorsque sa requête réseau n’a pas pu être annulée.
   */
  const forecastRequest = useRef(0);
  /**
   * Verrou d’une actualisation en cours, identifié par sa génération.
   * La comparaison au moment du nettoyage empêche une ancienne requête de libérer le verrou d’une nouvelle.
   */
  const activeRefresh = useRef<number | null>(null);

  /**
   * Réinitialise le parcours lorsque l’utilisateur commence une autre recherche.
   * La fonction reste stable entre les rendus pour pouvoir servir de dépendance à useLocationSearch
   * sans réarmer son délai à chaque modification des prévisions.
   */
  const resetForecast = useCallback(() => {
    // Une nouvelle recherche invalide les chargements et actualisations de la ville précédente.
    forecastRequest.current += 1;
    activeRefresh.current = null;
    setSelectedLocation(null);
    setForecast(null);
    setLoadingForecast(false);
    setRefreshing(false);
    setLastCheckAt(null);
    setForecastError(null);
  }, []);

  /**
   * Charge une ville ou retente son premier chargement après une erreur.
   * Les anciens résultats sont effacés pour ne pas afficher les notes d’un autre lieu sous le nouveau nom.
   * Seule la dernière demande peut publier ses données, son erreur ou sa fin de chargement.
   */
  async function loadForecast(location: Location) {
    const requestId = ++forecastRequest.current;
    setSelectedLocation(location);
    setLoadingForecast(true);
    setRefreshing(false);
    setForecastError(null);
    setForecast(null);
    setLastCheckAt(null);
    activeRefresh.current = null;
    try {
      const nextForecast = await getForecast(location);
      if (requestId !== forecastRequest.current) return;
      setForecast(nextForecast);
      setLastCheckAt(Date.now());
    } catch (caughtError) {
      if (requestId !== forecastRequest.current) return;
      setForecastError(
        caughtError instanceof Error
          ? caughtError.message
          : "Le service est momentanément indisponible.",
      );
    } finally {
      if (requestId === forecastRequest.current) setLoadingForecast(false);
    }
  }

  /**
   * Récupère une réponse plus récente sans masquer le tableau de bord pendant l’attente.
   * Le verrou bloque les doublons entre clic manuel, timer périodique et passage de créneau.
   * En cas d’échec, les mesures sont conservées ; leur âge décide si la recommandation reste utilisable.
   */
  const refreshForecast = useCallback(async () => {
    if (!selectedLocation || !forecast || activeRefresh.current !== null) return;
    const requestId = ++forecastRequest.current;
    activeRefresh.current = requestId;
    setRefreshing(true);
    try {
      const nextForecast = await getForecast(selectedLocation);
      if (requestId !== forecastRequest.current) return;
      setForecast(nextForecast);
    } catch {
      if (requestId !== forecastRequest.current) return;
      /**
       * La mise à jour fonctionnelle lit les données encore présentes au moment de l’échec.
       * Une date illisible est traitée comme ancienne ; un état stale ne redevient pas frais sur un échec.
       */
      setForecast((current) => {
        if (!current) return current;
        const retrievedAt = Date.parse(current.generated_at);
        const age = Date.now() - retrievedAt;
        const stale =
          current.data_state === "stale" || !Number.isFinite(age) || age > STALE_AFTER_MS;
        return {
          ...current,
          data_state: stale ? "stale" : "refresh_failed",
          recommendation_available: stale ? false : current.recommendation_available,
        };
      });
    } finally {
      if (activeRefresh.current === requestId) activeRefresh.current = null;
      if (requestId === forecastRequest.current) {
        setRefreshing(false);
        setLastCheckAt(Date.now());
      }
    }
  }, [forecast, selectedLocation]);

  /**
   * Programme le prochain contrôle à partir du dernier contrôle terminé.
   * Le timer est retiré dès que ses dépendances changent. S’il expire pendant que l’onglet est masqué,
   * aucune requête ne part : le gestionnaire de visibilité rattrapera ce contrôle au retour.
   */
  useEffect(() => {
    if (!forecast || !selectedLocation || lastCheckAt === null) return;
    const delay = periodicRefreshDelay(lastCheckAt, Date.now());
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") void refreshForecast();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [forecast, lastCheckAt, refreshForecast, selectedLocation]);

  /**
   * Vérifie aussi le passage au début du premier créneau, indépendamment du délai de quinze minutes.
   * Le calcul peut demander un rattrapage immédiat ou ne prévoir aucun timer si la frontière a déjà
   * été contrôlée. La même protection contre les onglets masqués s’applique.
   */
  useEffect(() => {
    if (!forecast || !selectedLocation) return;
    const delay = boundaryRefreshDelay(
      forecast.hours[0]?.time ?? "",
      lastCheckAt,
      Date.now(),
    );
    if (delay === null) return;
    if (delay === 0) {
      if (document.visibilityState === "visible") void refreshForecast();
      return;
    }

    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") void refreshForecast();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [forecast, lastCheckAt, refreshForecast, selectedLocation]);

  /**
   * Installe le rattrapage au retour sur la page avec les métadonnées de la réponse actuellement affichée.
   * L’écouteur est remplacé lorsque ces données changent et retiré au démontage pour éviter de conserver
   * une référence à une ancienne ville ou de déclencher des requêtes depuis un écran fermé.
   */
  useEffect(() => {
    if (!forecast || !selectedLocation) return;
    const currentForecast = forecast;

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (
        shouldRefreshWhenVisible(
          currentForecast.hours[0]?.time ?? "",
          currentForecast.generated_at,
          currentForecast.data_state,
          lastCheckAt,
          Date.now(),
        )
      ) {
        void refreshForecast();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [forecast, lastCheckAt, refreshForecast, selectedLocation]);

  /**
   * Invalide les réponses encore en vol au démontage, y compris pendant les vérifications de StrictMode.
   * Les timers et l’écouteur sont nettoyés par leurs effets respectifs ; ce nettoyage protège les promesses.
   */
  useEffect(() => {
    return () => {
      forecastRequest.current += 1;
      activeRefresh.current = null;
    };
  }, []);

  return {
    selectedLocation,
    forecast,
    loadingForecast,
    refreshing,
    forecastError,
    loadForecast,
    refreshForecast,
    resetForecast,
  };
}
