export interface Clock {
  /** Current instant as an ISO 8601 timestamp with milliseconds, in UTC. */
  now(): string;
  /** Current date as YYYY-MM-DD, in UTC. */
  today(): string;
}

/** Always returns the same instant. Used by tests and builds that must be reproducible. */
export function fixedClock(iso: string): Clock {
  const start = parseInstant(iso);
  return {
    now: () => new Date(start).toISOString(),
    today: () => new Date(start).toISOString().slice(0, 10),
  };
}

/** Starts at the given instant and advances with real time, so records get distinct timestamps. */
export function offsetClock(iso: string, realNow: () => number = Date.now): Clock {
  const offset = parseInstant(iso) - realNow();
  const instant = () => new Date(realNow() + offset);
  return {
    now: () => instant().toISOString(),
    today: () => instant().toISOString().slice(0, 10),
  };
}

export function clockFromConfig(iso: string, mode: string): Clock {
  if (mode === 'fixed') return fixedClock(iso);
  if (mode === 'offset') return offsetClock(iso);
  throw new Error(`CLOCK_MODE must be "fixed" or "offset", got "${mode}"`);
}

function parseInstant(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid clock value "${iso}"`);
  return ms;
}

/** Last day of the calendar quarter containing the date (standard fiscal year). */
export function endOfQuarter(date: string): string {
  const [year, month] = date.split('-').map(Number) as [number, number];
  const quarterEndMonth = Math.ceil(month / 3) * 3;
  const lastDay = new Date(Date.UTC(year, quarterEndMonth, 0));
  return lastDay.toISOString().slice(0, 10);
}
