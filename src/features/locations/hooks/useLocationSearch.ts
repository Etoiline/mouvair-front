/**
 * État et effets de la recherche de villes : saisie, temporisation, annulation et sélection.
 * Le hook garde les anciens résultats pendant leur remplacement et distingue l’attente du délai de
 * la requête réellement en cours. La sélection d’un résultat ne doit pas déclencher une nouvelle recherche.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import { searchLocations } from "../api";
import type { Location } from "../types";

/**
 * Seuil partagé avec le champ et le bouton afin d’aligner validation visuelle et déclenchement réseau.
 */
export const LOCATION_SEARCH_MIN_LENGTH = 3;
/**
 * Temps sans nouvelle frappe avant une recherche automatique, pour limiter les appels pendant la saisie.
 */
const LOCATION_SEARCH_DEBOUNCE_MS = 350;

/**
 * Pilote la recherche et retourne un contrôleur consommé par LocationSearch.
 * @param onSearchStart Callback stable appelé au départ d’une requête, utilisé par App pour invalider
 * les prévisions précédentes sans créer de dépendance directe de cette fonctionnalité vers forecast.
 */
export function useLocationSearch(onSearchStart: () => void) {
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [searchingLocations, setSearchingLocations] = useState(false);
  /**
   * Couvre à la fois la temporisation et la requête. Contrairement à searchingLocations, cet état
   * s’active dès la frappe pour garder le menu ouvert et rendre ses anciens choix temporairement inactifs.
   */
  const [locationResultsPending, setLocationResultsPending] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  /**
   * Le numéro de recherche ignore les réponses devenues obsolètes, y compris si l’annulation réseau
   * arrive trop tard. Le contrôleur AbortController interrompt en plus le travail de fetch quand c’est possible.
   */
  const locationSearchRequest = useRef(0);
  const locationSearchAbort = useRef<AbortController | null>(null);
  const locationSearchTimer = useRef<number | null>(null);
  /**
   * Marqueur consommé une seule fois : le nom réécrit après une sélection ne doit pas être interprété
   * comme une saisie utilisateur nécessitant sa propre requête automatique.
   */
  const skippedAutomaticLocationQuery = useRef<string | null>(null);

  /**
   * Lance une requête immédiate, annule la précédente et prévient le parcours parent.
   * Le menu n’est remplacé que par la réponse correspondant encore à la saisie courante.
   * Une annulation volontaire ne devient pas une erreur visible ; un résultat vide reçoit son propre message.
   */
  const runLocationSearch = useCallback(async (searchQuery: string) => {
    const requestId = ++locationSearchRequest.current;
    locationSearchAbort.current?.abort();
    const controller = new AbortController();
    locationSearchAbort.current = controller;
    setSearchingLocations(true);
    setLocationResultsPending(true);
    setSearchError(null);
    onSearchStart();
    try {
      const results = await searchLocations(searchQuery, controller.signal);
      if (requestId !== locationSearchRequest.current) return;
      setLocations(results);
      if (results.length === 0) {
        setSearchError("Aucune ville trouvée. Vérifiez l’orthographe ou précisez le pays.");
      }
    } catch (caughtError) {
      if (requestId !== locationSearchRequest.current || controller.signal.aborted) return;
      setLocations([]);
      setSearchError(caughtError instanceof Error ? caughtError.message : "Recherche impossible.");
    } finally {
      if (requestId === locationSearchRequest.current) {
        setSearchingLocations(false);
        setLocationResultsPending(false);
        if (locationSearchAbort.current === controller) locationSearchAbort.current = null;
      }
    }
  }, [onSearchStart]);

  /**
   * Réagit à chaque saisie : invalide d’abord tout délai ou toute réponse plus ancienne, puis applique
   * l’exception de sélection, le seuil minimal et enfin le délai avant recherche.
   * Le nettoyage retire le timer même si la saisie suivante arrive avant l’expiration des 350 ms.
   */
  useEffect(() => {
    const searchQuery = query.trim();

    // Toute nouvelle frappe invalide immédiatement le délai ou la réponse de la saisie précédente.
    if (locationSearchTimer.current !== null) {
      window.clearTimeout(locationSearchTimer.current);
      locationSearchTimer.current = null;
    }
    locationSearchRequest.current += 1;
    locationSearchAbort.current?.abort();
    locationSearchAbort.current = null;
    setSearchingLocations(false);
    setSearchError(null);

    const skippedQuery = skippedAutomaticLocationQuery.current;
    skippedAutomaticLocationQuery.current = null;
    if (skippedQuery === searchQuery) {
      setLocationResultsPending(false);
      setLocations([]);
      return;
    }

    if (searchQuery.length < LOCATION_SEARCH_MIN_LENGTH) {
      setLocationResultsPending(false);
      setLocations([]);
      return;
    }

    // Les résultats précédents restent affichés et deviennent temporairement inactifs pendant
    // le debounce puis la requête, afin d’éviter la fermeture et la réouverture du menu.
    setLocationResultsPending(true);

    const timer = window.setTimeout(() => {
      if (locationSearchTimer.current === timer) locationSearchTimer.current = null;
      void runLocationSearch(searchQuery);
    }, LOCATION_SEARCH_DEBOUNCE_MS);
    locationSearchTimer.current = timer;

    return () => {
      window.clearTimeout(timer);
      if (locationSearchTimer.current === timer) locationSearchTimer.current = null;
    };
  }, [query, runLocationSearch]);

  /**
   * Permet au bouton et à la touche Entrée de lancer la même recherche sans attendre le délai.
   * preventDefault conserve l’application React en place ; le timer différé est annulé pour qu’il
   * ne déclenche pas une deuxième requête juste après la soumission explicite.
   */
  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const searchQuery = query.trim();
    if (searchQuery.length < LOCATION_SEARCH_MIN_LENGTH) return;
    if (locationSearchTimer.current !== null) {
      window.clearTimeout(locationSearchTimer.current);
      locationSearchTimer.current = null;
    }
    setLocationResultsPending(true);
    void runLocationSearch(searchQuery);
  }

  /**
   * Ferme les résultats et réécrit le nom choisi dans le champ.
   * Le chargement des prévisions reste à la charge du parent via le composant ; le hook ne connaît
   * que la recherche. Le marqueur d’exception n’est posé que si la valeur du champ change réellement.
   */
  function chooseLocation(location: Location) {
    setLocations([]);
    if (query !== location.name) {
      // L’écriture du choix dans le champ ne doit pas relancer la recherche automatique.
      skippedAutomaticLocationQuery.current = location.name.trim();
      setQuery(location.name);
    }
    setSearchError(null);
  }

  /**
   * Au démontage du composant, annule fetch et invalide aussi les promesses simulées ou déjà résolues.
   * Le timer de saisie est retiré par le nettoyage de l’effet qui l’a créé.
   */
  useEffect(() => {
    return () => {
      // Le démontage invalide aussi les réponses qui arriveraient après la disparition du champ.
      locationSearchRequest.current += 1;
      locationSearchAbort.current?.abort();
    };
  }, []);

  return {
    query,
    setQuery,
    locations,
    searchingLocations,
    locationResultsPending,
    searchError,
    handleSearch,
    chooseLocation,
  };
}

/**
 * Contrat du contrôleur déduit du hook pour que la vue reste synchronisée avec les états et actions
 * réellement exposés, sans recopier manuellement leur typage dans le composant.
 */
export type LocationSearchController = ReturnType<typeof useLocationSearch>;
