# Mouv’Air — Frontend

Interface React et TypeScript du projet Mouv’Air.

Utiliser Node.js 22 à partir de 22.22.2, Node.js 24 à partir de 24.15.0, ou Node.js 26 et plus,
avec pnpm. Ces versions correspondent aux prérequis des outils de test, notamment jsdom.
La version Node de référence est indiquée dans `.node-version` et la version de pnpm dans
`packageManager`, dans `package.json`. La CI utilise ces deux versions.

```powershell
pnpm install
pnpm dev
```

Copier `.env.example` vers `.env` uniquement si l'API n'est pas lancée sur `http://localhost:8000`.

## Organisation du frontend

```text
src/
├── app/                     # Assemblage de l’écran, mise en page et styles globaux
├── features/
│   ├── locations/            # Recherche et sélection d’une ville
│   └── forecast/             # Chargement, actualisation et affichage des prévisions
├── shared/
│   ├── api/http.ts           # Client HTTP et gestion commune des erreurs
│   └── lib/dateTime.ts       # Dates et horaires dans le fuseau du lieu
├── test/                    # Configuration et données partagées des tests
├── main.tsx                 # Démarrage de React
└── vite-env.d.ts
```

Chaque fonctionnalité regroupe son contrat API (`types.ts`), ses requêtes (`api.ts`), ses
composants, ses hooks et ses fonctions sans état (`lib/`). Les styles sont placés à côté du
composant concerné, avec ses variantes mobiles et sombres. Les tests sont placés à côté du code
qu’ils vérifient ; les parcours complets se trouvent dans `app/App.test.tsx`.

Les couleurs et espacements réutilisés sont centralisés dans `app/tokens.css`, avec la palette
sombre. Chaque composant conserve sa disposition et ses nuances spécifiques dans sa feuille CSS.

Le [guide d’architecture](docs/architecture.md) précise les responsabilités et les conventions à
suivre pour ajouter un écran ou faire évoluer une fonctionnalité. Les sources, tests, styles et
scripts comportent des commentaires en français sur leurs contrats, leurs états et les choix
importants. Le [guide de configuration](docs/configuration.md) détaille aussi les fichiers à la
racine, notamment `package.json` qui ne permet pas d’insérer des commentaires directement.

## Déploiement sur Vercel

Importer ce dépôt comme projet Vite, utiliser `pnpm build` comme commande de construction et `dist`
comme répertoire de sortie. La variable de production doit viser le domaine public Railway de l’API :

```dotenv
VITE_API_URL=https://mouvair-api.up.railway.app/api
```

Lorsque le domaine personnalisé sera disponible, remplacer cette valeur par une URL telle que
`https://api.mouvair.example.dev/api`, puis reconstruire le frontend.

## Vérifications automatiques

Le workflow [Frontend checks](.github/workflows/checks.yml) exécute les vérifications à chaque
push et pull request, et peut aussi être lancé manuellement dans GitHub Actions. Il installe les
dépendances avec `pnpm install --frozen-lockfile`, réutilise leur cache, puis lance la même commande
qu’en local :

```powershell
pnpm check
```

Cette commande exécute toute la suite de tests, puis vérifie les types TypeScript et construit le
frontend de production. Une erreur fait échouer la vérification. Les tests simulent les API :
aucun backend ni secret de déploiement n’est nécessaire. Le fonctionnement de la CI est décrit
dans le [guide de configuration](docs/configuration.md).

## Tests

La suite Vitest utilise Testing Library et un DOM simulé. Elle vérifie les principaux parcours de
l’interface sans appeler le backend réel : recherche de ville avec conservation des résultats durant
leur mise à jour, sélection dans le graphique horaire et meilleur créneau, navigation entre les
détails du créneau, actualisation réussie ou échouée, nouvel essai après un échec initial et erreur de
recherche. Les tests des hooks couvrent aussi les réponses tardives, l’annulation des recherches,
l’actualisation au changement de créneau, le retour sur un onglet masqué, les données trop anciennes
et le nettoyage au démontage. Un parcours vérifie la conservation de l’activité et de l’onglet de
détail lors d’un changement de ville.

```powershell
pnpm test
pnpm test:watch
```

## Résumé d’un créneau

Le créneau sélectionné présente d’abord sa date, ses horaires locaux et l’activité choisie. La note
globale apparaît avant les notes météo et qualité de l’air. Une donnée manquante est signalée sans
masquer les notes disponibles ; les alertes météo restent visibles et « À retenir » présente au
maximum deux explications météo. Une carte unique regroupe ensuite les détails dans
trois onglets : météo, qualité de l’air et pollens. Leur hauteur reste constante sur grand écran ;
sur mobile, elle suit le contenu du panneau actif pour éviter les espaces vides. L’onglet météo associe la
température ressentie, les précipitations, le vent moyen et les rafales à leurs sous-notes
respectives. La valeur
intermédiaire utilisée par le calcul du vent n’est pas présentée comme une mesure météo. L’onglet de
qualité de l’air conserve l’AQI européen brut, sa catégorie et les recommandations fournies pour la
population générale et les personnes sensibles. La valeur AQI est affichée seule, sans unité ni
libellé accolé. L’onglet pollen présente les concentrations horaires d’aulne, bouleau,
graminées, armoise, olivier et ambroisie en grains/m³. Une valeur nulle au sens numérique reste
affichée comme `0`, tandis qu’une donnée absente est indiquée comme indisponible. Les pollens
n’entrent pas dans les notes Mouv’Air. Sur mobile, ces six concentrations sont regroupées sur deux
colonnes afin de limiter la hauteur du panneau. Lorsque l’appareil utilise le thème sombre, les
cartes emploient des surfaces et des séparateurs renforcés pour conserver une hiérarchie visuelle
claire. Les 24 créneaux sont représentés chronologiquement dans un
graphique en barres regroupé par date locale. Son sous-titre « Note globale sur 100 » rappelle
l’échelle, l’activité étant déjà indiquée dans le sélecteur. Chaque barre indique la note globale et son état ; un
clic sélectionne le créneau correspondant. Les alertes météo, les données incomplètes et le meilleur
créneau restent repérables dans le graphique. Le meilleur créneau est également accessible depuis
le bouton récapitulatif, et le premier est retenu en cas d’égalité. Un avertissement accompagne une
meilleure option défavorable,
tandis que l’absence de note complète et la suspension pour données anciennes restent distinctes.
Le contrat de score utilisé par l’interface contient uniquement les sections imbriquées `weather`,
`air` et `overall`, qui portent chacune les données propres à leur rôle.

## Présentation sur mobile

L’accueil utilise un en-tête dont la hauteur suit son contenu. Après le choix d’une ville,
l’introduction s’efface visuellement et la recherche tient sur une ligne avec un bouton loupe,
dont le libellé reste accessible aux lecteurs d’écran. Ce mode compact est conservé pendant les
recherches suivantes pour éviter les sauts de mise en page.

Le tableau de bord présente l’activité, la note globale puis les deux notes météo et air côte à
côte. Le graphique horaire précède les détails, afin de choisir un créneau avant d’examiner ses
mesures ; un repère indique son défilement tactile. Les mesures météo sont regroupées en lignes
avec leurs sous-notes à droite. Les trois onglets de détails restent visibles et seul le panneau
actif occupe de la hauteur sur petit écran. Les concentrations de pollen conservent deux colonnes.

## Actualisation des prévisions

Le bouton « Actualiser » conserve les résultats visibles pendant la récupération. Lorsque la page
reste ouverte, elle vérifie aussi les prévisions toutes les 15 minutes et au début d’un nouveau
créneau. Aucun appel automatique n’est lancé lorsque l’onglet est masqué ; les données sont vérifiées
au retour sur la page si un contrôle a été manqué ou si les données mises en cache ont dépassé leur
durée de réutilisation.

La recherche de ville et le premier chargement des prévisions disposent d’états séparés. À partir de
trois caractères, la recherche se lance automatiquement après un court délai sans nouvelle frappe ;
une saisie plus récente annule la requête précédente, tandis que le bouton ou la touche Entrée permet
un déclenchement immédiat. Les résultats s’ouvrent en surimpression sous le champ sans déplacer le
reste de la page. Après le choix d’une ville, son nom remplace la saisie dans le champ sans relancer
la recherche, puis l’interface annonce le chargement en cours. Si cette première récupération
échoue, elle conserve la recherche accessible et propose de réessayer directement pour la même ville.
Lorsqu’une lettre est ajoutée à une recherche affichée, la liste reste ouverte sous un
indicateur de chargement, puis son contenu est remplacé par les nouveaux résultats.

## Créer une release

Le dépôt doit être propre et `CHANGELOG.md` doit contenir au moins une ligne de changement non
publiée sous son titre. Le script demande s’il faut incrémenter la version majeure, mineure ou
corrective, met à jour `package.json` et le changelog, puis crée le commit `🔖 Release x.y.z` :

```powershell
pnpm release
```

Pour prévisualiser la prochaine version sans modifier le dépôt ni créer de commit :

```powershell
pnpm run release -- --dry-run
```
