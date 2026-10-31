/**
 * Transport JSON commun aux fonctionnalités du frontend.
 * L’URL de base comprend déjà le préfixe /api ; les appelants fournissent un chemin commençant par /.
 * Ce module normalise les erreurs HTTP mais laisse les hooks décider de leur affichage et des retries.
 */

/**
 * Vite remplace cette variable lors du démarrage ou de la construction du frontend.
 * La valeur locale permet de démarrer sans fichier .env lorsque l’API utilise son port habituel.
 */
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

/**
 * Effectue une requête GET et propage le signal d’annulation jusqu’à fetch.
 * Les erreurs FastAPI utilisent généralement detail ; un corps non JSON conserve le message générique.
 * Le paramètre T décrit le contrat attendu pour TypeScript : aucune validation des données reçues
 * n’est effectuée à l’exécution, et les erreurs réseau restent celles émises par fetch.
 *
 * @param path Chemin relatif à l’URL de l’API, paramètres de recherche inclus.
 * @param signal Signal optionnel utilisé notamment pour abandonner une recherche de ville.
 * @throws Une erreur HTTP lisible ou l’erreur réseau/annulation d’origine.
 */
export async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { signal });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(payload?.detail ?? "Le service est momentanément indisponible.");
  }
  return response.json() as Promise<T>;
}
