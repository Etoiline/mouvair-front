#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..");
const PACKAGE_JSON_PATH = path.join(PROJECT_ROOT, "package.json");
const CHANGELOG_PATH = path.join(PROJECT_ROOT, "CHANGELOG.md");
const CHANGELOG_START_PATTERN = /^# Changelog(?:\r?\n){2}/;
const RELEASE_HEADING_PATTERN = /^## (?<version>\d+\.\d+\.\d+) - \d{4}-\d{2}-\d{2}\s*$/m;

/** Erreur attendue empêchant de créer une release fiable. */
class ReleaseError extends Error {}

/**
 * Exécute Git à la racine et transforme ses échecs en erreurs lisibles.
 *
 * @param {string[]} argumentsList Arguments transmis à Git.
 * @param {boolean} captureOutput Indique si la sortie doit être retournée.
 * @returns {string} Sortie standard nettoyée quand elle est capturée.
 */
function runGit(argumentsList, captureOutput = false) {
  const result = spawnSync("git", argumentsList, {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    stdio: captureOutput ? "pipe" : "inherit",
  });

  if (result.error) {
    throw new ReleaseError(`Impossible d’exécuter Git : ${result.error.message}`);
  }
  if (result.status !== 0) {
    const detail = captureOutput ? (result.stderr || result.stdout || "").trim() : "";
    throw new ReleaseError(
      `La commande Git a échoué : git ${argumentsList.join(" ")}${detail ? `\n${detail}` : ""}`,
    );
  }
  return captureOutput ? result.stdout.trim() : "";
}

/** Vérifie que le script agit sur sa racine et sur un dépôt sans changement local. */
function ensureCleanRepository() {
  const repositoryRoot = path.resolve(runGit(["rev-parse", "--show-toplevel"], true));
  const normalizePath = (value) =>
    process.platform === "win32" ? value.toLocaleLowerCase("en-US") : value;

  if (normalizePath(repositoryRoot) !== normalizePath(PROJECT_ROOT)) {
    throw new ReleaseError(
      `La racine Git attendue est ${PROJECT_ROOT}, pas ${repositoryRoot}.`,
    );
  }

  const status = runGit(["status", "--porcelain"], true);
  if (status) {
    throw new ReleaseError(
      `Le dépôt doit être propre avant une release. Committez ou annulez ces changements :\n${status}`,
    );
  }
}

/**
 * Convertit une version SemVer stricte en segments numériques.
 *
 * @param {string} value Version au format MAJOR.MINOR.PATCH.
 * @returns {{ major: number, minor: number, patch: number }} Version structurée.
 */
function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) {
    throw new ReleaseError(`Version invalide "${value}". Format attendu : MAJOR.MINOR.PATCH.`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

/**
 * Calcule la prochaine version pour le niveau SemVer choisi.
 *
 * @param {string} currentVersion Version courante.
 * @param {"major" | "minor" | "patch"} part Niveau à incrémenter.
 * @returns {string} Prochaine version.
 */
function bumpVersion(currentVersion, part) {
  const version = parseVersion(currentVersion);
  if (part === "major") return `${version.major + 1}.0.0`;
  if (part === "minor") return `${version.major}.${version.minor + 1}.0`;
  if (part === "patch") return `${version.major}.${version.minor}.${version.patch + 1}`;
  throw new ReleaseError(`Niveau de version inconnu : "${part}".`);
}

/**
 * Valide le bloc non publié et la cohérence de la dernière release.
 *
 * @param {string} changelog Contenu du changelog.
 * @param {string} currentVersion Version du package.
 * @returns {number} Position où insérer le titre de release.
 */
function validateChangelog(changelog, currentVersion) {
  const start = CHANGELOG_START_PATTERN.exec(changelog);
  if (!start) {
    throw new ReleaseError(
      'CHANGELOG.md doit commencer par "# Changelog" suivi d’une ligne vide.',
    );
  }

  const contentAfterTitle = changelog.slice(start[0].length);
  const latestRelease = RELEASE_HEADING_PATTERN.exec(contentAfterTitle);
  if (!latestRelease) {
    throw new ReleaseError("CHANGELOG.md ne contient aucune section de version valide.");
  }

  const pendingChanges = contentAfterTitle.slice(0, latestRelease.index);
  if (/^#{1,6}\s/m.test(pendingChanges)) {
    throw new ReleaseError(
      "Les changements non publiés doivent rester sans titre entre # Changelog et la dernière version.",
    );
  }
  if (!/^-\s+\S/m.test(pendingChanges)) {
    throw new ReleaseError("Aucun changement non publié n’est présent en haut de CHANGELOG.md.");
  }

  const changelogVersion = latestRelease.groups.version;
  parseVersion(changelogVersion);
  if (changelogVersion !== currentVersion) {
    throw new ReleaseError(
      `Versions désynchronisées : package.json=${currentVersion}, CHANGELOG.md=${changelogVersion}.`,
    );
  }
  return start[0].length;
}

/**
 * Demande le niveau SemVer jusqu'à obtenir un choix reconnu.
 *
 * @param {string} currentVersion Version courante.
 * @returns {Promise<"major" | "minor" | "patch">} Niveau choisi.
 */
async function askBump(currentVersion) {
  const choices = new Map([
    ["1", "patch"],
    ["2", "minor"],
    ["3", "major"],
  ]);
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log(`Version actuelle : ${currentVersion}`);
  console.log(`1. patch  -> ${bumpVersion(currentVersion, "patch")}`);
  console.log(`2. minor  -> ${bumpVersion(currentVersion, "minor")}`);
  console.log(`3. major  -> ${bumpVersion(currentVersion, "major")}`);

  try {
    while (true) {
      const rawAnswer = await prompt.question("Choisissez le niveau de version [patch] : ");
      const answer = rawAnswer.trim().toLowerCase() || "patch";
      const choice = choices.get(answer) || answer;
      if (["patch", "minor", "major"].includes(choice)) return choice;
      console.log("Choix invalide. Saisissez patch, minor, major, 1, 2 ou 3.");
    }
  } catch (error) {
    throw new ReleaseError("Release annulée.", { cause: error });
  } finally {
    prompt.close();
  }
}

/** Retourne la date locale au format ISO utilisé par le changelog. */
function currentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Valide, versionne et committe la prochaine release du frontend. */
async function main() {
  const argumentsList = process.argv.slice(2);
  const unknownArguments = argumentsList.filter((argument) => argument !== "--dry-run");
  if (unknownArguments.length > 0) {
    throw new ReleaseError(`Option inconnue : ${unknownArguments.join(", ")}.`);
  }

  ensureCleanRepository();

  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  if (typeof packageJson.version !== "string") {
    throw new ReleaseError("package.json doit contenir une version textuelle.");
  }
  parseVersion(packageJson.version);

  const changelog = fs.readFileSync(CHANGELOG_PATH, "utf8");
  const insertionIndex = validateChangelog(changelog, packageJson.version);
  const nextVersion = bumpVersion(packageJson.version, await askBump(packageJson.version));
  const releaseHeading = `## ${nextVersion} - ${currentDate()}\n\n`;
  const nextChangelog =
    changelog.slice(0, insertionIndex) + releaseHeading + changelog.slice(insertionIndex);

  if (argumentsList.includes("--dry-run")) {
    console.log(`Prévisualisation : ${packageJson.version} -> ${nextVersion}`);
    console.log(`Entrée du changelog : ${releaseHeading.trim()}`);
    console.log(`Commit : 🔖 Release ${nextVersion}`);
    return;
  }

  packageJson.version = nextVersion;
  fs.writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
  fs.writeFileSync(CHANGELOG_PATH, nextChangelog.replace(/\r\n/g, "\n"), "utf8");

  runGit(["add", "--", path.basename(PACKAGE_JSON_PATH), path.basename(CHANGELOG_PATH)]);
  runGit(["commit", "-m", `🔖 Release ${nextVersion}`]);

  const remainingChanges = runGit(["status", "--porcelain"], true);
  if (remainingChanges) {
    throw new ReleaseError(
      `Le commit a été créé, mais le dépôt n’est plus propre :\n${remainingChanges}`,
    );
  }
  console.log(`Release ${nextVersion} créée dans le commit courant.`);
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Erreur : ${message}`);
  process.exitCode = 1;
}
