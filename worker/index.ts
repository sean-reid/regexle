import {
  MAX_ATTEMPTS,
  type GuessResponse,
  type PuzzleResponse,
  type StatsResponse,
} from "../shared/api.ts";
import { dateWithinWindow, latestAllowedNumber, puzzleNumber } from "../shared/day.ts";
import { allGreen, grade, isGrid } from "../shared/grade.ts";
import { puzzleKey, type StoredPuzzle } from "../shared/store.ts";
import { PuzzleResults } from "./results.ts";
import { issue, newNonce, verify } from "./token.ts";

export { PuzzleResults };

export interface Env {
  ASSETS: Fetcher;
  PUZZLES: KVNamespace;
  RESULTS: DurableObjectNamespace<PuzzleResults>;
  GUESS_RATE: RateLimit;
  SESSION_SECRET: string;
}

const json = (body: unknown, status = 200, cache = "no-store"): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": cache },
  });

const error = (status: number, message: string): Response => json({ error: message }, status);

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const puzzles = new Map<number, StoredPuzzle>();

async function loadPuzzle(env: Env, number: number): Promise<StoredPuzzle | null> {
  const cached = puzzles.get(number);
  if (cached) return cached;
  const stored = await env.PUZZLES.get<StoredPuzzle>(puzzleKey(number), "json");
  if (!stored || !isGrid(stored.answer)) return null;
  puzzles.set(number, stored);
  return stored;
}

// Yesterday, today, and tomorrow in UTC cover every local date on earth.
function isOpen(number: unknown, now: number): number is number {
  if (typeof number !== "number" || !Number.isInteger(number)) return false;
  const latest = latestAllowedNumber(now);
  return number <= latest && number >= latest - 2;
}

async function limited(env: Env, request: Request): Promise<boolean> {
  const key = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.GUESS_RATE.limit({ key });
  return !success;
}

async function handlePuzzle(url: URL, env: Env): Promise<Response> {
  const date = url.searchParams.get("date") ?? "";
  if (!dateWithinWindow(date, Date.now())) return error(400, "bad date");
  const number = puzzleNumber(date);
  if (number === null || number < 1) return error(400, "bad date");
  const puzzle = await loadPuzzle(env, number);
  if (!puzzle) return error(404, "no puzzle");
  const body: PuzzleResponse = { number, date, rows: puzzle.rows, cols: puzzle.cols };
  return json(body, 200, "public, max-age=60");
}

async function handleGuess(request: Request, env: Env): Promise<Response> {
  if (await limited(env, request)) return error(429, "slow down");
  const body = await readJson(request);
  if (!body) return error(400, "bad request");
  const now = Date.now();
  if (!isOpen(body.number, now)) return error(404, "puzzle not open");
  const number = body.number;
  if (!isGrid(body.grid)) return error(400, "bad grid");

  let attempt = 0;
  let nonce = newNonce();
  if (body.token !== undefined) {
    const session = await verify(env.SESSION_SECRET, body.token);
    if (!session || session.number !== number) return error(400, "bad token");
    if (session.done) return error(409, "game over");
    attempt = session.attempt;
    nonce = session.nonce;
  }
  attempt += 1;

  const puzzle = await loadPuzzle(env, number);
  if (!puzzle) return error(404, "no puzzle");
  const marks = grade(puzzle.answer, body.grid);
  const correct = allGreen(marks);
  const done = correct || attempt >= MAX_ATTEMPTS;
  const token = await issue(env.SESSION_SECRET, { number, attempt, done, nonce });
  const response: GuessResponse = { marks, correct, attempt, done, token };
  if (done) {
    const stub = env.RESULTS.get(env.RESULTS.idFromName(String(number)));
    response.stats = await stub.record(nonce, correct ? attempt : 0);
    if (!correct) response.answer = puzzle.answer;
  }
  return json(response);
}

async function handleStats(numberText: string, env: Env): Promise<Response> {
  const number = Number(numberText);
  if (!isOpen(number, Date.now())) return error(404, "puzzle not open");
  const stub = env.RESULTS.get(env.RESULTS.idFromName(String(number)));
  const body: StatsResponse = { number, ...(await stub.histogram()) };
  return json(body, 200, "public, max-age=30");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    if (pathname === "/api/puzzle" && method === "GET") return handlePuzzle(url, env);
    if (pathname === "/api/guess" && method === "POST") return handleGuess(request, env);
    const stats = /^\/api\/stats\/(\d{1,6})$/.exec(pathname);
    if (stats && method === "GET") return handleStats(stats[1]!, env);
    if (pathname.startsWith("/api/")) return error(404, "not found");
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
