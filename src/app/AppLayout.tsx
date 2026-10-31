/**
 * Cadre visuel commun à la page : identité, introduction, recherche et pied de page.
 * Les deux emplacements ReactNode permettent à App de fournir les vues métier sans que la mise
 * en page ait besoin de connaître leurs états, leurs types de données ou leurs actions réseau.
 */

import type { ReactNode } from "react";

import "./AppLayout.css";

/**
 * Place la recherche dans l’en-tête puis le contenu du parcours avant les informations de source.
 * L’ancre top permet au lien de marque de revenir à l’en-tête sans imposer de routeur à cette page.
 */
export function AppLayout({ search, children }: { search: ReactNode; children: ReactNode }) {
  return (
    <main>
      <header className="hero" id="top">
        <nav>
          <a className="brand" href="#top" aria-label="Mouv’Air, accueil">
            <span className="brand__mark">M</span>
            Mouv’Air
          </a>
          <span className="live-dot"><i /> Données horaires</span>
        </nav>

        <div className="hero__copy">
          <p className="eyebrow">Météo · air · mouvement</p>
          <h1>Le bon moment<br />pour sortir.</h1>
          <p className="intro">
            Une note claire pour choisir quand courir, pédaler ou marcher selon les conditions
            près de chez vous.
          </p>
        </div>
        {search}
      </header>
      {children}
      <footer>
        <p>Un indicateur de conditions extérieures, pas un avis médical.</p>
        <p>Données météo Open-Meteo · Qualité de l’air CAMS ENSEMBLE via Open-Meteo</p>
      </footer>
    </main>
  );
}
