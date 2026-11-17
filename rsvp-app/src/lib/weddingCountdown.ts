/** Resolve the wedding's wall-clock date/time in its configured time zone. */
export function weddingTimestamp(date: string | null, time = "00:00", timezone = "America/Santo_Domingo") {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  if (new Date(wallClock).toISOString().slice(0, 10) !== date) return null;
  try {
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
    let timestamp = wallClock;
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(part => [part.type, part.value]));
      const zoned = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
      timestamp += wallClock - zoned;
    }
    const final = Object.fromEntries(formatter.formatToParts(timestamp).map(part => [part.type, part.value]));
    if (Date.UTC(Number(final.year), Number(final.month) - 1, Number(final.day), Number(final.hour), Number(final.minute), Number(final.second)) !== wallClock) return null;
    return timestamp;
  } catch { return null; }
}

export function countdownParts(timestamp: number, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((timestamp - now) / 1000));
  return { days: Math.floor(seconds / 86400), hours: Math.floor(seconds / 3600) % 24,
    minutes: Math.floor(seconds / 60) % 60, seconds: seconds % 60 };
}
