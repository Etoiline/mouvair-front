/**
 * Formatage des dates et horaires dans le fuseau du lieu de prévision.
 * Toutes les fonctions reçoivent ce fuseau explicitement : l’affichage ne doit pas dépendre du réglage
 * de l’ordinateur. Les intervalles conservent les décalages ISO pour traiter les heures répétées.
 */

/**
 * Le format long sert aux détails et le format court aux repères plus compacts du tableau de bord.
 */
type DateStyle = "long" | "short";

/**
 * Centralise la conversion des horodatages et refuse une date invalide avant de la formater.
 * L’exception évite qu’une donnée incohérente soit présentée comme un horaire utilisable.
 */
function asDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Horaire invalide : ${value}`);
  }
  return date;
}

/**
 * Produit une date française dans le fuseau demandé, avec ou sans les noms complets du jour et du mois.
 * La conversion peut changer le jour civil par rapport à la date UTC de l’horodatage reçu.
 */
export function formatLocalDate(
  value: string,
  timeZone: string,
  style: DateStyle = "long",
): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
    timeZone,
  }).format(asDate(value));
}

/**
 * Fournit une clé de regroupement année-mois-jour fondée sur la date locale du lieu.
 * La locale fr-CA sépare cette clé technique du libellé français destiné à être lu à l’écran.
 */
export function localDateKey(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(asDate(value));
}

/**
 * Extrait séparément heure et minute pour produire « 9 h » ou « 9 h 30 ».
 * Le cycle h23 évite d’afficher minuit comme 24 h ; les minutes nulles sont volontairement omises.
 */
function formatTime(value: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(asDate(value));
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = parts.find((part) => part.type === "minute")?.value;

  if (!Number.isFinite(hour) || minute === undefined) {
    throw new RangeError(`Horaire impossible à formater : ${value}`);
  }
  return minute === "00" ? `${hour} h` : `${hour} h ${minute}`;
}

/**
 * Point d’entrée public du formatage horaire, commun au graphique et aux informations de récupération.
 */
export function formatLocalTime(value: string, timeZone: string): string {
  return formatTime(value, timeZone);
}

/**
 * Lit uniquement un décalage explicite à la fin d’une chaîne ISO, par exemple Z ou +02:00.
 * Il s’agit du décalage présent dans la donnée, pas d’un recalcul à partir du fuseau demandé.
 * Une chaîne sans décalage reconnu retourne null pour ne pas inventer d’indication UTC.
 */
function formatOffset(value: string): string | null {
  const match = value.match(/(Z|([+-])(\d{2}):(\d{2}))$/);
  if (!match) return null;
  if (match[1] === "Z") return "UTC";

  const sign = match[2];
  const hours = Number(match[3]);
  const minutes = match[4];
  return minutes === "00" ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${minutes}`;
}

/**
 * Présente deux horaires locaux comme un intervalle compact.
 * Lorsque les deux heures civiles sont identiques mais les décalages différents, les mentions UTC
 * rendent visible le passage à l’heure d’hiver et les deux occurrences d’une même heure.
 */
export function formatLocalInterval(start: string, end: string, timeZone: string): string {
  const startTime = formatTime(start, timeZone);
  const endTime = formatTime(end, timeZone);
  const startOffset = formatOffset(start);
  const endOffset = formatOffset(end);

  // Les décalages rendent explicites les deux occurrences d’une heure répétée en automne.
  if (startTime === endTime && startOffset && endOffset && startOffset !== endOffset) {
    return `${startTime} (${startOffset})–${endTime} (${endOffset})`;
  }
  return `${startTime}–${endTime}`;
}

/**
 * Groupe générique conservant une clé locale, son libellé lisible et les éléments dans leur ordre d’entrée.
 */
export type LocalDateGroup<T> = {
  key: string;
  label: string;
  items: T[];
};

/**
 * Regroupe les éléments sans modifier le tableau reçu et sans trier les créneaux.
 * La Map conserve l’ordre de première apparition des jours ; l’ordre chronologique reste donc
 * celui fourni par l’appelant, y compris pour des créneaux proches de minuit UTC.
 */
export function groupByLocalDate<T extends { time: string }>(
  items: T[],
  timeZone: string,
): LocalDateGroup<T>[] {
  const groups = new Map<string, LocalDateGroup<T>>();

  for (const item of items) {
    // La date locale évite de rattacher un créneau au mauvais jour à cause de sa date UTC.
    const key = localDateKey(item.time, timeZone);
    const group = groups.get(key);
    if (group) {
      group.items.push(item);
    } else {
      groups.set(key, {
        key,
        label: formatLocalDate(item.time, timeZone),
        items: [item],
      });
    }
  }

  return Array.from(groups.values());
}

/**
 * Résume un créneau par sa date et ses deux horaires locaux.
 * Si le créneau traverse minuit dans le fuseau du lieu, la date de fin est aussi affichée afin
 * que l’intervalle ne semble pas appartenir entièrement à la date de départ.
 */
export function formatSlot(
  start: string,
  end: string,
  timeZone: string,
  style: DateStyle = "long",
): string {
  const startDate = formatLocalDate(start, timeZone, style);
  const interval = formatLocalInterval(start, end, timeZone);
  if (localDateKey(start, timeZone) === localDateKey(end, timeZone)) {
    return `${startDate}, ${interval}`;
  }

  const endDate = formatLocalDate(end, timeZone, style);
  return `${startDate}, ${formatTime(start, timeZone)}–${endDate}, ${formatTime(end, timeZone)}`;
}

/**
 * Construit la mention de contexte « Heure locale » avec le nom du fuseau et les décalages reçus.
 * Les underscores sont remplacés pour la lecture ; un changement de décalage entre début et fin
 * est indiqué par une flèche plutôt que masqué derrière un seul décalage.
 */
export function formatTimeZoneLabel(start: string, end: string, timeZone: string): string {
  const name = timeZone.replaceAll("_", " ");
  const startOffset = formatOffset(start);
  const endOffset = formatOffset(end);
  if (!startOffset) return `Heure locale · ${name}`;
  if (endOffset && endOffset !== startOffset) {
    return `Heure locale · ${name} (${startOffset} → ${endOffset})`;
  }
  return `Heure locale · ${name} (${startOffset})`;
}
