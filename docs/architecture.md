# Architecture du frontend

Le frontend reste une application React et TypeScript construite par Vite. Les fichiers sont
regroupés par responsabilité et par fonctionnalité pour permettre de modifier une partie de
l’interface sans parcourir un composant unique.

## Assemblage de l’application

`src/main.tsx` charge les styles globaux et monte React. `src/app/App.tsx` relie la recherche de
ville au chargement des prévisions et compose les vues. `AppLayout.tsx` porte l’en-tête, le pied de
page et les emplacements de contenu. Il ne connaît ni les requêtes ni les données métier.

## Fonctionnalités

| Dossier | Responsabilité |
| --- | --- |
| `features/locations/api.ts` et `types.ts` | Recherche de villes et contrat des lieux renvoyés par l’API. |
| `features/locations/hooks/useLocationSearch.ts` | Saisie, délai avant recherche, annulation, résultats et erreurs de recherche. |
| `features/locations/components/LocationSearch.tsx` | Formulaire et menu des résultats. |
| `features/forecast/api.ts` et `types.ts` | Requête de prévisions et contrat des créneaux, mesures et notes. |
| `features/forecast/hooks/useForecast.ts` | Chargement initial, nouvel essai, actualisation, ancienneté et invalidation des réponses. |
| `features/forecast/components/ForecastDashboard.tsx` | Activité choisie, sélection du créneau, meilleur créneau et assemblage du tableau de bord. |
| `features/forecast/components/ForecastStatus.tsx` | Chargement initial et erreur avec bouton de nouvel essai. |
| `features/forecast/components/ScoreCard.tsx` | Notes globale et détaillées, alertes et explications. |
| `features/forecast/components/HourlyScoreChart.tsx` | Graphique horaire, légende, repères et sélection. |
| `features/forecast/components/details/` | Navigation entre les détails météo, qualité de l’air et pollens, puis affichage de chaque panneau. |
| `features/forecast/lib/` | Classement des créneaux, planification des contrôles, présentation des statuts et formatage des mesures. |

La recherche et les prévisions possèdent des états séparés. Au démarrage d’une recherche, `App`
relie le hook de recherche à `resetForecast` : les prévisions de la ville précédente sont effacées
et ses réponses en cours sont invalidées. Choisir une ville met à jour le champ sans relancer la
recherche, puis charge ses prévisions.

`ForecastDashboard` reste monté lorsque les données sont absentes. Cela conserve l’activité et
l’onglet de détail entre deux villes. Le créneau sélectionné est conservé pendant une actualisation
s’il existe encore ; sinon le tableau de bord sélectionne le premier créneau disponible.

## Code partagé et dépendances

`shared/api/http.ts` centralise l’URL de l’API, les appels JSON et les messages d’erreur HTTP.
`shared/lib/dateTime.ts` contient les fonctions de dates réutilisables, indépendantes de React et
des fonctionnalités.

Les imports suivent ces règles :

- `app` peut assembler les fonctionnalités et utiliser `shared` ;
- les fonctionnalités peuvent utiliser `shared`, qui ne dépend jamais d’elles ;
- les prévisions utilisent le type `Location` et son libellé depuis `locations` ; la recherche de
  villes ne dépend pas des prévisions ;
- les composants affichent les données ; les hooks gèrent l’état et les effets ; les fonctions de
  `lib` ne déclenchent aucune requête ;
- les imports visent directement le fichier concerné, sans fichier de réexportation général.

Les seuils de calcul, les catégories de qualité de l’air et les recommandations restent définis par
le backend. Le frontend se charge de leur présentation.

## Styles

Chaque vue importe son fichier CSS voisin. Ce fichier contient ses styles de base, ses règles
adaptées aux petits écrans et ses variantes `prefers-color-scheme: dark`. Une modification visuelle
d’un panneau se fait donc dans son dossier.

`app/global.css` contient les polices, les variables de couleur, les styles HTML communs, la classe
partagée `eyebrow` et l’animation de chargement. `AppLayout.css` contient la présentation du cadre
de la page et de l’état d’accueil.

Les classes conservent leur préfixe de composant, par exemple `score-card__context` ou
`conditions-details__tab`, pour limiter les interactions entre les feuilles de styles.

## Tests et vérifications

Les fichiers `*.test.ts` et `*.test.tsx` sont placés à côté des hooks ou composants testés.
`src/app/App.test.tsx` vérifie les parcours complets. `src/test/setup.ts` configure le nettoyage du
DOM après chaque test ; `src/test/fixtures.ts` fournit les données et promesses contrôlées communes.
Les tests simulent les appels des modules `api.ts` sans dépendre du backend.

Après une réorganisation, vérifier les parcours et la compilation de production :

```powershell
pnpm test
pnpm build
```

## Ajouter du code

Pour modifier une fonctionnalité existante, placer le code dans son dossier et extraire un nouveau
composant lorsqu’il possède une responsabilité d’affichage distincte. Garder les petits composants
utilisés uniquement par une vue dans le même fichier lorsque cela facilite la lecture.

Créer une nouvelle fonctionnalité sous `features/` lorsqu’un besoin métier distinct apparaît.
Déplacer une fonction vers `shared/` seulement si elle est indépendante d’une fonctionnalité.
Conserver les scripts de maintenance dans `scripts/` et la documentation technique dans `docs/`.

## Lire et maintenir les commentaires

Chaque fichier source commence par une explication de son rôle et de sa place dans le parcours.
Les fonctions publiques, les composants et les contrats de données possèdent des commentaires
qui décrivent leurs entrées, leurs responsabilités et les cas particuliers utiles à leur appelant.
Les commentaires situés près des effets expliquent la temporisation, la visibilité de l’onglet,
l’invalidation des réponses et le nettoyage des ressources.

Les commentaires des vues décrivent les relations d’accessibilité et la conservation des états.
Les feuilles CSS expliquent leur structure, les variables reçues de React, les changements de
disposition sur mobile et les adaptations au thème sombre. Les scénarios de tests indiquent
pourquoi le temps ou l’ordre des réponses sont contrôlés, en complément de leurs noms.

Faire évoluer ces explications avec le code concerné. Documenter un contrat, une unité, un
invariant ou une raison de conception plutôt que paraphraser chaque instruction. Une valeur
absente reste notamment différente de zéro, une note reste différente d’une mesure brute et
l’heure de récupération reste différente de l’heure du dernier contrôle local.

Les fichiers de configuration et le script de release sont décrits dans le
[guide de configuration](configuration.md). Les formats stricts ou générés y sont expliqués sans
ajouter de commentaires qui les rendraient invalides ou qui seraient perdus à la prochaine génération.
