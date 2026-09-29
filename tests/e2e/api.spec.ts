import { expect, test, type APIRequestContext } from "@playwright/test";
import { generatePuzzle } from "../../generator/generate.ts";
import {
  MAX_ATTEMPTS,
  type GuessResponse,
  type PuzzleResponse,
  type StatsResponse,
} from "../../shared/api.ts";
import { puzzleNumber } from "../../shared/day.ts";

const today = new Date().toISOString().slice(0, 10);
const number = puzzleNumber(today)!;
const local = generatePuzzle("dev", number);
const wrong = ["ZZZZZ", "ZZZZZ", "ZZZZZ", "ZZZZZ", "ZZZZZ"];

const guess = async (request: APIRequestContext, grid: string[], token?: string) =>
  request.post("/api/guess", { data: { number, grid, ...(token ? { token } : {}) } });

test.describe.configure({ mode: "serial" });

test("serves today's clues without the answer", async ({ request }) => {
  const res = await request.get(`/api/puzzle?date=${today}`);
  expect(res.status()).toBe(200);
  const body = (await res.json()) as PuzzleResponse;
  expect(body.number).toBe(number);
  expect(body.rows).toEqual(local.rows);
  expect(body.cols).toEqual(local.cols);
  expect(JSON.stringify(body)).not.toContain("answer");
});

test("refuses dates outside the window and malformed grids", async ({ request }) => {
  expect((await request.get("/api/puzzle?date=2020-01-01")).status()).toBe(400);
  expect((await request.get("/api/puzzle?date=nope")).status()).toBe(400);
  expect((await guess(request, ["ABC"])).status()).toBe(400);
  const far = await request.post("/api/guess", { data: { number: number + 50, grid: wrong } });
  expect(far.status()).toBe(404);
});

test("grades a wrong grid and hands back a session token", async ({ request }) => {
  const res = await guess(request, wrong);
  expect(res.status()).toBe(200);
  const body = (await res.json()) as GuessResponse;
  expect(body.attempt).toBe(1);
  expect(body.done).toBe(false);
  expect(body.correct).toBe(false);
  expect(body.marks).toHaveLength(5);
  for (const row of body.marks) expect(row).toMatch(/^[gyx]{5}$/);
  expect(body.token.split(".")).toHaveLength(5);
  expect(body.answer).toBeUndefined();
});

test("a correct grid wins, records once, and closes the session", async ({ request }) => {
  const before = (await (await request.get(`/api/stats/${number}`)).json()) as StatsResponse;
  const first = (await (await guess(request, wrong)).json()) as GuessResponse;
  const win = (await (await guess(request, local.answer, first.token)).json()) as GuessResponse;
  expect(win.correct).toBe(true);
  expect(win.done).toBe(true);
  expect(win.attempt).toBe(2);
  expect(win.marks).toEqual(["ggggg", "ggggg", "ggggg", "ggggg", "ggggg"]);
  expect(win.stats?.counts[2]).toBe((before.counts[2] ?? 0) + 1);
  expect((await guess(request, wrong, win.token)).status()).toBe(409);
  const after = (await (await request.get(`/api/stats/${number}`)).json()) as StatsResponse;
  expect(after.total).toBe(before.total + 1);
});

test("six misses reveal the answer and count as a fail", async ({ request }) => {
  const before = (await (await request.get(`/api/stats/${number}`)).json()) as StatsResponse;
  let token: string | undefined;
  let last: GuessResponse | undefined;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    last = (await (await guess(request, wrong, token)).json()) as GuessResponse;
    token = last.token;
  }
  expect(last?.done).toBe(true);
  expect(last?.correct).toBe(false);
  expect(last?.answer).toEqual(local.answer);
  expect(last?.stats?.counts[0]).toBe((before.counts[0] ?? 0) + 1);
});

test("rejects a forged token", async ({ request }) => {
  const first = (await (await guess(request, wrong)).json()) as GuessResponse;
  const forged = first.token.replace(/^(\d+)\.1\./, "$1.0.");
  expect((await guess(request, wrong, forged)).status()).toBe(400);
  expect((await guess(request, wrong, "garbage")).status()).toBe(400);
});
