/**
 * Point d’entrée navigateur chargé par index.html.
 * Les styles globaux précèdent ceux des vues ; une seule racine React prend ensuite en charge
 * le contenu de #root. StrictMode aide à détecter les effets dont le nettoyage est incomplet en développement.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./app/global.css";
import App from "./app/App";

/**
 * Le conteneur est garanti par le document HTML du projet, d’où l’assertion de présence.
 * Cette initialisation est réservée au démarrage ; les composants mettent ensuite l’écran à jour sans
 * recréer la racine ni remplacer manuellement le contenu du document.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

