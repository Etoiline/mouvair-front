/**
 * Préparation commune exécutée par Vitest avant chaque fichier de tests.
 * Le nettoyage explicite évite qu’un écran monté par un test conserve son DOM, ses effets ou ses
 * écouteurs dans le test suivant, notamment lorsque plusieurs tests cherchent le même libellé accessible.
 */

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Démonte les arbres React à la fin de chaque scénario, même lorsqu’une assertion échoue.
 */
afterEach(() => {
  cleanup();
});
