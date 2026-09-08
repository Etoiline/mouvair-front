type DateStyle = "long" | "short";

function asDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Horaire invalide : ${value}`);
  }
  return date;
}

function formatDate(value: string, timeZone: string, style: DateStyle): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
    timeZone,
  }).format(asDate(value));
}

function dateKey(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(asDate(value));
}

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

function formatOffset(value: string): string | null {
  const match = value.match(/(Z|([+-])(\d{2}):(\d{2}))$/);
  if (!match) return null;
  if (match[1] === "Z") return "UTC";

  const sign = match[2];
  const hours = Number(match[3]);
  const minutes = match[4];
  return minutes === "00" ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${minutes}`;
}

function formatInterval(start: string, end: string, timeZone: string): string {
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

export function formatSlot(
  start: string,
  end: string,
  timeZone: string,
  style: DateStyle = "long",
): string {
  const startDate = formatDate(start, timeZone, style);
  const interval = formatInterval(start, end, timeZone);
  if (dateKey(start, timeZone) === dateKey(end, timeZone)) {
    return `${startDate}, ${interval}`;
  }

  const endDate = formatDate(end, timeZone, style);
  return `${startDate}, ${formatTime(start, timeZone)}–${endDate}, ${formatTime(end, timeZone)}`;
}

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
