# Mouv’Air — Frontend

Interface React et TypeScript du projet Mouv’Air.

```powershell
pnpm install
pnpm dev
```

Copier `.env.example` vers `.env` uniquement si l'API n'est pas lancée sur `http://localhost:8000`.

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
n’entrent pas dans les notes Mouv’Air.

## Actualisation des prévisions

Le bouton « Actualiser » conserve les résultats visibles pendant la récupération. Lorsque la page
reste ouverte, elle vérifie aussi les prévisions toutes les 15 minutes et au début d’un nouveau
créneau. Aucun appel automatique n’est lancé lorsque l’onglet est masqué ; les données sont vérifiées
au retour sur la page si un contrôle a été manqué ou si les données mises en cache ont dépassé leur
durée de réutilisation.

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
