/**
 * Configuration de la suite frontend.
 * Vitest retrouve les fichiers *.test.ts et *.test.tsx dans leurs dossiers respectifs, sans imposer
 * un répertoire de tests séparé. Les API sont simulées dans chaque scénario selon le besoin.
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    /**
     * Fournit document, les événements et les éléments DOM nécessaires à React Testing Library.
     */
    environment: "jsdom",
    /**
     * Charge le nettoyage commun avant les tests, indépendamment de leur emplacement dans src.
     */
    setupFiles: ["./src/test/setup.ts"],
    /**
     * Efface l’historique des appels entre les tests. Les suites qui programment des réponses
     * utilisent aussi resetAllMocks pour effacer leurs implémentations précédentes.
     */
    clearMocks: true,
  },
});
