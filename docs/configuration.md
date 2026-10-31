# Configuration et fichiers du frontend

Ce guide complète les commentaires des sources et le [guide d’architecture](architecture.md).
Il décrit les fichiers de démarrage et de configuration ainsi que les documents à la racine du
frontend. Les fichiers JSON stricts et les fichiers générés conservent leur format d’origine.

## `package.json`

Ce manifeste est lu par pnpm et les outils de construction. Il utilise du JSON strict, qui ne
permet pas les commentaires ; les explications de ses champs sont donc regroupées ici.

| Champ | Rôle dans ce projet |
| --- | --- |
| `name` | Identifie le package du frontend auprès des outils Node et pnpm. |
| `private` | Empêche de publier ce package comme bibliothèque sur un registre. |
| `version` | Version du frontend, maintenue avec le changelog par le script de release. |
| `type` | La valeur `module` configure les fichiers JavaScript du package comme modules ES. |
| `scripts` | Noms des commandes communes de développement, vérification et maintenance. |
| `dependencies` | React et React DOM, utilisés pour monter et mettre à jour l’interface. |
| `devDependencies` | Outils de compilation, de développement, de test et déclarations de types. |

### Commandes

| Commande | Ce qu’elle exécute |
| --- | --- |
| `pnpm dev` | Démarre Vite pour servir l’application pendant le développement. |
| `pnpm build` | Vérifie les types avec `tsc`, puis construit le frontend avec Vite dans `dist/`. |
| `pnpm test` | Exécute une fois toute la suite Vitest. |
| `pnpm test:watch` | Garde Vitest ouvert pour relancer les tests pendant les modifications. |
| `pnpm preview` | Sert le résultat déjà construit pour le consulter localement. |
| `pnpm release` | Lance le script interactif de version et de commit décrit plus bas. |

TypeScript vérifie le contrat des sources et des tests. Vite sert l’application et construit ses
ressources. Vitest exécute les scénarios ; jsdom fournit leur environnement DOM. Testing Library
et user-event servent à monter React et à reproduire les interactions. Les packages `@types/*`
fournissent les déclarations nécessaires à la vérification TypeScript.

## `pnpm-lock.yaml`

Le verrou contient les versions résolues et les relations exactes entre dépendances, en complément
des plages de versions du manifeste. Il permet de réutiliser le même graphe de dépendances sur les
autres machines et en déploiement.

Ce fichier est maintenu par pnpm lors des opérations sur les dépendances. Il n’est pas commenté
manuellement : ces annotations risqueraient d’être supprimées lors d’une réécriture et masqueraient
les changements réellement liés aux dépendances.

## `tsconfig.json`

La configuration TypeScript accepte les commentaires et chaque groupe d’options est expliqué
directement dans le fichier.

- `target` et `lib` définissent les fonctionnalités JavaScript et les API de navigateur reconnues ;
- `module` et `moduleResolution` conservent les imports pour leur traitement par Vite ;
- `strict`, les contrôles d’éléments inutilisés et la vérification de casse repèrent les erreurs dans
  les sources, notamment après un déplacement de fichiers ;
- `noEmit` laisse la production des fichiers de distribution à Vite ;
- `jsx` utilise la transformation JSX automatique de React ;
- `include` limite le projet TypeScript à `src/`, tests compris.

`skipLibCheck` évite de revérifier les déclarations des dépendances, sans retirer la vérification
du code applicatif. Le script Node de release, placé dans `scripts/`, reste en dehors de ce projet
TypeScript.

## `vitest.config.ts`

Cette configuration sélectionne jsdom, charge `src/test/setup.ts` et efface l’historique des mocks
entre les scénarios. Les suites qui programment des réponses API réinitialisent aussi leurs
implémentations avec `resetAllMocks`.

Les tests restent à côté du code qu’ils vérifient. Le dossier `src/test/` regroupe la préparation
commune et les fixtures, tandis que `src/app/App.test.tsx` vérifie l’assemblage du parcours complet.

## Démarrage navigateur

`index.html` définit la langue, les métadonnées, le conteneur `#root` et le chargement de
`src/main.tsx`. Ce point d’entrée importe les styles globaux et monte `App` dans une racine React
unique. `StrictMode` vérifie notamment le bon nettoyage des effets pendant le développement.

`src/vite-env.d.ts` charge les déclarations de Vite pour les variables d’environnement et les
imports de ressources. Il ne contient pas de valeurs de configuration et ne produit pas de code
exécuté dans le navigateur.

## `.env.example` et `.gitignore`

`.env.example` documente l’URL de base attendue par le client HTTP. Cette adresse inclut `/api` ;
les fonctions de chaque fonctionnalité ajoutent ensuite leur propre chemin. Copier le fichier
vers `.env` seulement si l’adresse par défaut doit changer.

`VITE_API_URL` est intégrée au frontend par Vite. En production, définir cette variable avant la
construction, puis reconstruire le frontend si sa valeur change. Le préfixe `VITE_` désigne une
configuration accessible au navigateur.

`.gitignore` exclut les dépendances installées, le résultat de construction et le fichier `.env`
local. Les sources, le verrou de dépendances et l’exemple d’environnement restent versionnés.

## `scripts/release.mjs`

Le script de release est un module Node indépendant de l’application. Il calcule sa racine à
partir de son propre chemin et contrôle qu’il agit sur le bon dépôt, sans changement local.

Son déroulement est le suivant :

1. Vérifier les arguments, la version du manifeste et celle de la dernière section du changelog.
2. Vérifier la présence de changements non publiés sous `# Changelog`, sans titre intermédiaire.
3. Demander le niveau de version : `patch`, `minor` ou `major`, en affichant les résultats possibles.
4. Insérer le titre de la nouvelle version avant les changements en attente et mettre à jour le
   manifeste.
5. Ajouter ces deux fichiers à l’index Git et créer le commit local de release.
6. Signaler une éventuelle modification apparue pendant l’opération.

La date du titre est le jour local de la machine qui exécute le script. Le script ne crée pas de
tag et ne pousse pas le commit. L’option `--dry-run` conserve les validations et le choix interactif,
puis affiche la version, le titre et le message de commit prévus sans écrire les fichiers :

```powershell
pnpm run release -- --dry-run
```

## Documents du dépôt

| Document | Rôle |
| --- | --- |
| `README.md` | Démarrage, organisation, déploiement, tests et comportement de l’interface. |
| `docs/architecture.md` | Responsabilités des dossiers, dépendances et conventions de maintenance. |
| `docs/configuration.md` | Explications des fichiers de configuration et de maintenance. |
| `CHANGELOG.md` | Historique des changements et des versions, au format attendu par le script. |
| `AGENTS.md` | Instructions du dépôt pour les modifications, la documentation et les commits après validation. |

Ces documents sont déjà des explications lisibles. Les commentaires techniques sont maintenus
près du code concerné, tandis que les décisions générales et les modes d’emploi restent dans ces
guides.
