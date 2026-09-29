import { MAX_ATTEMPTS, type Histogram } from "../shared/api";

export interface Attempt {
  grid: string[];
  marks: string[];
}

export interface Game {
  number: number;
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

export type Theme = "system" | "light" | "dark";

const GAME = "regexle:game";
const RECORD = "regexle:record";
const THEME = "regexle:theme";
const CONTRAST = "regexle:contrast";

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

export function loadGame(number: number): Game {
  const stored = read<Game>(GAME);
  if (stored && stored.number === number && Array.isArray(stored.attempts)) return stored;
  return { number, attempts: [], done: false, won: false, draft: emptyDraft() };
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

export function getTheme(): Theme {
  const t = read<string>(THEME) ?? localStorage.getItem(THEME);
  return t === "light" || t === "dark" ? t : "system";
}

export function setTheme(theme: Theme): void {
  try {
    if (theme === "system") localStorage.removeItem(THEME);
    else localStorage.setItem(THEME, theme);
  } catch {
    return;
  }
  if (theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
}

export function getContrast(): boolean {
  try {
    return localStorage.getItem(CONTRAST) === "1";
  } catch {
    return false;
  }
}

export function setContrast(on: boolean): void {
  try {
    if (on) localStorage.setItem(CONTRAST, "1");
    else localStorage.removeItem(CONTRAST);
  } catch {
    return;
  }
  if (on) document.documentElement.dataset.contrast = "1";
  else delete document.documentElement.dataset.contrast;
}
