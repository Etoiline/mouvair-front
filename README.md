# Mouv’Air — Frontend

Interface React et TypeScript du projet Mouv’Air.

```powershell
pnpm install
pnpm dev
```

Copier `.env.example` vers `.env` uniquement si l'API n'est pas lancée sur `http://localhost:8000`.

## Tests

La suite Vitest utilise Testing Library et un DOM simulé. Elle vérifie les principaux parcours de
l’interface sans appeler le backend réel : sélection et meilleur créneau, actualisation réussie ou
échouée, nouvel essai après un échec initial et erreur de recherche.

```powershell
pnpm test
pnpm test:watch
```

## Résumé d’un créneau

Le créneau sélectionné présente d’abord sa date, ses horaires locaux et l’activité choisie. La note
globale apparaît avant les notes météo et qualité de l’air. Une donnée manquante est signalée sans
masquer les notes disponibles ; les alertes météo restent visibles et deux explications principales
au maximum résument les facteurs déterminants. Le détail météo associe ensuite la température
ressentie, les précipitations, le vent moyen et les rafales à leurs sous-notes respectives. La valeur
intermédiaire utilisée par le calcul du vent n’est pas présentée comme une mesure météo. Le détail
de la qualité de l’air conserve l’AQI européen brut, sa catégorie et les recommandations fournies
pour la population générale et les personnes sensibles. L’AQI est présenté comme un indice sans
unité, jamais comme un pourcentage. Le bloc pollen présente les concentrations horaires d’aulne,
bouleau, graminées, armoise, olivier et ambroisie en grains/m³. Une valeur nulle au sens numérique
reste affichée comme `0`, tandis qu’une donnée absente est indiquée comme indisponible. Les pollens
n’entrent pas dans les notes Mouv’Air. Les 24 créneaux sont regroupés par date locale et restent
classés chronologiquement. Chaque carte présente l’horaire, la note globale, son appréciation et la
présence éventuelle d’une alerte météo ; les créneaux incomplets restent sélectionnables. Le meilleur
créneau complet est signalé dans la liste et accessible depuis le bouton récapitulatif. Le premier
créneau est retenu en cas d’égalité. Un avertissement accompagne une meilleure option défavorable,
tandis que l’absence de note complète et la suspension pour données anciennes restent distinctes.
Le contrat de score utilisé par l’interface contient uniquement les sections imbriquées `weather`,
`air` et `overall`, qui portent chacune les données propres à leur rôle.

## Actualisation des prévisions

Le bouton « Actualiser » conserve les résultats visibles pendant la récupération. Lorsque la page
reste ouverte, elle vérifie aussi les prévisions toutes les 15 minutes et au début d’un nouveau
créneau. Aucun appel automatique n’est lancé lorsque l’onglet est masqué ; les données sont vérifiées
au retour sur la page si un contrôle a été manqué ou si les données mises en cache ont dépassé leur
durée de réutilisation.

La recherche de ville et le premier chargement des prévisions disposent d’états séparés. À partir de
trois caractères, la recherche se lance automatiquement après un court délai sans nouvelle frappe ;
une saisie plus récente annule la requête précédente, tandis que le bouton ou la touche Entrée permet
un déclenchement immédiat. Après le choix d’une ville, l’interface annonce le chargement en cours. Si
cette première récupération échoue, elle conserve la recherche accessible et propose de réessayer
directement pour la même ville.

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
