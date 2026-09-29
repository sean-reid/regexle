import { MAX_ATTEMPTS, type Histogram } from "../shared/api";

export interface Attempt {
  grid: string[];
  marks: string[];
}

export interface Game {
  number: number;
  clues: string;
  attempts: Attempt[];
  token?: string;
  done: boolean;
  won: boolean;
  answer?: string[];
  stats?: Histogram;
  draft: string[];
}

export interface Record {
  played: number;
  won: number;
  streak: number;
  maxStreak: number;
  lastPlayed: number;
  dist: number[];
}

export type Theme = "light" | "dark";

const GAME = "regexle:game";
const RECORD = "regexle:record";
const THEME = "regexle:theme";

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

export const emptyDraft = (): string[] => new Array<string>(5).fill("     ");

// A saved game only counts for the same puzzle number with the same clues,
// so a regenerated puzzle starts clean.
export function loadGame(number: number, clues: string): Game {
  const stored = read<Game>(GAME);
  if (
    stored &&
    stored.number === number &&
    stored.clues === clues &&
    Array.isArray(stored.attempts)
  ) {
    return stored;
  }
  return { number, clues, attempts: [], done: false, won: false, draft: emptyDraft() };
}

export const saveGame = (game: Game): void => write(GAME, game);

export function loadRecord(): Record {
  return (
    read<Record>(RECORD) ?? {
      played: 0,
      won: 0,
      streak: 0,
      maxStreak: 0,
      lastPlayed: 0,
      dist: new Array<number>(MAX_ATTEMPTS + 1).fill(0),
    }
  );
}

// A streak survives only when consecutive puzzle numbers are won.
export function recordFinish(number: number, won: boolean, attempts: number): Record {
  const r = loadRecord();
  if (r.lastPlayed === number) return r;
  r.played += 1;
  if (won) {
    r.won += 1;
    r.streak = r.lastPlayed === number - 1 ? r.streak + 1 : 1;
    r.maxStreak = Math.max(r.maxStreak, r.streak);
    r.dist[attempts] = (r.dist[attempts] ?? 0) + 1;
  } else {
    r.streak = 0;
    r.dist[0] = (r.dist[0] ?? 0) + 1;
  }
  r.lastPlayed = number;
  write(RECORD, r);
  return r;
}

export const currentStreak = (r: Record, number: number): number =>
  r.lastPlayed >= number - 1 ? r.streak : 0;

function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(THEME);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

// The stored choice wins; otherwise the page follows the system setting.
export function effectiveTheme(): Theme {
  return storedTheme() ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

export function toggleTheme(): Theme {
  const next: Theme = effectiveTheme() === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME, next);
  } catch {
    /* the page still switches for this visit */
  }
  document.documentElement.dataset.theme = next;
  return next;
}
