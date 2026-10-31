/**
 * Cadre visuel commun à la page : identité, introduction, recherche et pied de page.
 * Les deux emplacements ReactNode permettent à App de fournir les vues métier sans que la mise
 * en page ait besoin de connaître leurs états, leurs types de données ou leurs actions réseau.
 * Les classes app-layout isolent son décor des éléments main, nav, footer et des titres des autres vues.
 */

import type { ReactNode } from "react";

import "./AppLayout.css";

/**
 * Place la recherche dans l’en-tête puis le contenu du parcours avant les informations de source.
 * L’ancre top permet au lien de marque de revenir à l’en-tête sans imposer de routeur à cette page.
 * Sur mobile, compact réserve la place aux résultats en retirant visuellement l’introduction après
 * la première sélection. Le titre principal reste disponible pour les technologies d’assistance.
 */
export function AppLayout({
  search,
  children,
  compact,
}: {
  search: ReactNode;
  children: ReactNode;
  compact: boolean;
}) {
  return (
    <main className="app-layout">
      <header
        className={`app-layout__hero${compact ? " app-layout__hero--compact" : ""}`}
        id="top"
      >
        <nav className="app-layout__nav">
          <a className="app-layout__brand" href="#top" aria-label="Mouv’Air, accueil">
            <span className="app-layout__brand-mark">M</span>
            Mouv’Air
          </a>
          <span className="app-layout__status"><i className="app-layout__status-dot" /> Données horaires</span>
        </nav>

        <div className="app-layout__intro">
          <p className="eyebrow app-layout__eyebrow">Météo · air · mouvement</p>
          <h1 className="app-layout__title">Le bon moment<br />pour sortir.</h1>
          <p className="app-layout__description">
            Une note claire pour choisir quand courir, pédaler ou marcher selon les conditions
            près de chez vous.
          </p>
        </div>
        {search}
      </header>
      {children}
      <footer className="app-layout__footer">
        <p className="app-layout__notice">Un indicateur de conditions extérieures, pas un avis médical.</p>
        <p className="app-layout__notice">Données météo Open-Meteo · Qualité de l’air CAMS ENSEMBLE via Open-Meteo</p>
      </footer>
    </main>
  );
}
