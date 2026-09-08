# Mouv’Air — Frontend

Interface React et TypeScript du projet Mouv’Air.

```powershell
pnpm install
pnpm dev
```

Copier `.env.example` vers `.env` uniquement si l'API n'est pas lancée sur `http://localhost:8000`.

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
