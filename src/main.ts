import { MAX_ATTEMPTS, type GuessResponse } from "../shared/api";
import { localIsoDate, msUntilLocalMidnight, puzzleNumber } from "../shared/day";
import { LINE } from "../shared/regex/ast";
import { explain } from "../shared/regex/explain";
import { ApiError, fetchPuzzle, fetchStats, postGuess } from "./api";
import { Board } from "./board";
import { bindPhysicalKeys, buildKeyboard } from "./keyboard";
import { copyText, shareText } from "./share";
import {
  currentStreak,
  effectiveTheme,
  loadGame,
  loadRecord,
  recordFinish,
  saveGame,
  toggleTheme,
  type Game,
} from "./state";
import { renderDist, renderFigures } from "./stats";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const today = localIsoDate();
const number = puzzleNumber(today) ?? 1;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const board = new Board($("cells"));
const rowClues = $("row-clues");
const colClues = $("col-clues");
const focusRow = $<HTMLButtonElement>("focus-row");
const focusCol = $<HTMLButtonElement>("focus-col");
const explainEl = $("explain");
const notice = $("notice");
const attemptsEl = $("attempts");
const submit = $<HTMLButtonElement>("submit");
const helpDialog = $<HTMLDialogElement>("help");
const statsDialog = $<HTMLDialogElement>("stats");

const game: Game = loadGame(number);
let clues: { rows: string[]; cols: string[] } | null = null;
let busy = false;
let explained: string | null = null;
let noticeTimer = 0;
let countdownTimer = 0;

$("issue").textContent = `No. ${number} · ${new Date().toLocaleDateString(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})}`;

function showNotice(text: string, sticky = false): void {
  clearTimeout(noticeTimer);
  notice.textContent = text;
  if (!sticky) noticeTimer = window.setTimeout(() => (notice.textContent = ""), 2500);
}

function renderClues(): void {
  if (!clues) return;
  rowClues.replaceChildren(
    ...clues.rows.map((clue, r) => {
      const li = document.createElement("li");
      li.textContent = clue;
      li.addEventListener("click", () => board.setActive(r * LINE + (board.active % LINE)));
      return li;
    }),
  );
  colClues.replaceChildren(
    ...clues.cols.map((clue, c) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = clue;
      li.append(span);
      li.addEventListener("click", () =>
        board.setActive(Math.floor(board.active / LINE) * LINE + c),
      );
      return li;
    }),
  );
  renderFocus();
}

function renderFocus(): void {
  if (!clues) return;
  const r = Math.floor(board.active / LINE);
  const c = board.active % LINE;
  focusRow.replaceChildren(label(`Row ${r + 1}`), code(clues.rows[r] ?? ""));
  focusCol.replaceChildren(label(`Col ${c + 1}`), code(clues.cols[c] ?? ""));
  rowClues.querySelectorAll("li").forEach((li, i) => li.classList.toggle("current", i === r));
  colClues.querySelectorAll("li").forEach((li, i) => li.classList.toggle("current", i === c));
  if (explained !== null && explained !== clues.rows[r] && explained !== clues.cols[c]) {
    explained = null;
    explainEl.hidden = true;
  }
}

function label(text: string): HTMLElement {
  const el = document.createElement("span");
  el.className = "clue-label";
  el.textContent = text;
  return el;
}

function code(text: string): HTMLElement {
  const el = document.createElement("code");
  el.textContent = text;
  return el;
}

function toggleExplain(clue: string): void {
  if (explained === clue) {
    explained = null;
    explainEl.hidden = true;
    return;
  }
  explained = clue;
  explainEl.textContent = explain(clue) ?? "";
  explainEl.hidden = false;
}

function renderAttempts(): void {
  attemptsEl.replaceChildren(
    ...Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
      const li = document.createElement("li");
      const attempt = game.attempts[i];
      if (!attempt) {
        li.className = "attempt empty";
        return li;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.className = "attempt";
      b.setAttribute("aria-label", `Check ${i + 1} of ${MAX_ATTEMPTS}, bring it back`);
      for (const m of attempt.marks.join("")) {
        const dot = document.createElement("span");
        dot.className = `dot ${m}`;
        b.append(dot);
      }
      b.addEventListener("click", () => {
        if (game.done) return;
        board.load(attempt.grid, attempt.marks);
        renderFocus();
      });
      li.append(b);
      return li;
    }),
  );
}

async function check(): Promise<void> {
  if (busy || game.done || !clues) return;
  const grid = board.grid();
  if (!grid) {
    board.shake();
    showNotice("Fill every cell first.");
    return;
  }
  busy = true;
  submit.disabled = true;
  let result: GuessResponse;
  try {
    result = await postGuess(number, grid, game.token);
  } catch (err) {
    busy = false;
    submit.disabled = false;
    if (err instanceof ApiError && err.status === 404) {
      showNotice("A new puzzle is ready. Reload to play it.", true);
    } else if (err instanceof ApiError && err.status === 409) {
      showNotice("This game is already finished.", true);
    } else if (err instanceof ApiError && err.status === 429) {
      showNotice("Too many checks in a row. Take a breath.");
    } else {
      showNotice("Could not reach the server. Try again.");
    }
    return;
  }
  game.attempts.push({ grid, marks: result.marks });
  game.token = result.token;
  game.done = result.done;
  game.won = result.correct;
  if (result.answer) game.answer = result.answer;
  if (result.stats) game.stats = result.stats;
  game.draft = grid;
  saveGame(game);
  board.locked = true;
  await board.reveal(result.marks, reducedMotion);
  board.locked = game.done;
  renderAttempts();
  busy = false;
  submit.disabled = game.done;
  if (game.done) finish();
  else showNotice(`${MAX_ATTEMPTS - game.attempts.length} checks left.`);
}

function finish(): void {
  recordFinish(number, game.won, game.attempts.length);
  if (!game.won && game.answer) board.showAnswer(game.answer);
  board.locked = true;
  submit.disabled = true;
  setTimeout(openStats, reducedMotion ? 0 : 600);
}

function openStats(): void {
  const record = loadRecord();
  renderFigures($("figures"), record, currentStreak(record, number));
  renderDist($("your-dist"), record.dist, game.done ? (game.won ? game.attempts.length : 0) : null);
  const title = $("result-title");
  title.hidden = !game.done;
  if (game.done) {
    title.textContent = game.won
      ? game.attempts.length === 1
        ? "Solved in one."
        : `Solved in ${game.attempts.length}.`
      : "Not this time.";
  }
  $("result-actions").hidden = !game.done;
  $("share-done").textContent = "";
  renderGlobal(game.stats?.counts ?? null, game.stats?.total ?? 0);
  void fetchStats(number)
    .then((s) => renderGlobal(s.counts, s.total))
    .catch(() => undefined);
  tickCountdown();
  countdownTimer = window.setInterval(tickCountdown, 1000);
  statsDialog.showModal();
}

function renderGlobal(counts: number[] | null, total: number): void {
  const note = $("global-note");
  if (!counts || total === 0) {
    $("global-dist").replaceChildren();
    note.textContent = "Nobody has finished today's puzzle yet.";
    return;
  }
  renderDist($("global-dist"), counts, game.done ? (game.won ? game.attempts.length : 0) : null);
  note.textContent = `${total} finished ${total === 1 ? "game" : "games"} so far today.`;
}

function tickCountdown(): void {
  const ms = msUntilLocalMidnight();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  $("next").textContent = `Next puzzle in ${pad(h)}:${pad(m)}:${pad(s)}`;
}

statsDialog.addEventListener("close", () => clearInterval(countdownTimer));

async function share(): Promise<void> {
  const text = shareText(number, game.attempts, game.won, effectiveTheme() === "dark");
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ text });
      return;
    } catch {
      /* fall through to the clipboard */
    }
  }
  $("share-done").textContent = (await copyText(text)) ? "Copied." : "Could not copy.";
}

function onKey(key: string): void {
  if (game.done) return;
  if (key === "Enter") void check();
  else if (key === "Backspace") board.backspace();
  else if (/^[A-Z]$/.test(key)) board.type(key);
}

function labelThemeButton(): void {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  $("theme-button").setAttribute("aria-label", `Switch to ${next} mode`);
}

function restore(): void {
  const last = game.attempts[game.attempts.length - 1];
  if (last) board.load(game.draft, last.grid.join("") === game.draft.join("") ? last.marks : null);
  else board.load(game.draft, null);
  renderAttempts();
  if (game.done) {
    if (!game.won && game.answer) board.showAnswer(game.answer);
    board.locked = true;
    submit.disabled = true;
  }
}

async function start(): Promise<void> {
  buildKeyboard($("keyboard"), onKey);
  bindPhysicalKeys(onKey, (dr, dc) => board.move(dr, dc));
  board.onActive = renderFocus;
  focusRow.addEventListener(
    "click",
    () => clues && toggleExplain(clues.rows[Math.floor(board.active / LINE)] ?? ""),
  );
  focusCol.addEventListener(
    "click",
    () => clues && toggleExplain(clues.cols[board.active % LINE] ?? ""),
  );
  submit.addEventListener("click", () => void check());
  $("help-button").addEventListener("click", () => helpDialog.showModal());
  $("stats-button").addEventListener("click", openStats);
  $("theme-button").addEventListener("click", () => {
    toggleTheme();
    labelThemeButton();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", labelThemeButton);
  $("share").addEventListener("click", () => void share());
  labelThemeButton();
  restore();

  try {
    const puzzle = await fetchPuzzle(today);
    clues = { rows: puzzle.rows, cols: puzzle.cols };
  } catch (err) {
    showNotice(
      err instanceof ApiError && err.status === 404
        ? "Today's puzzle is not ready yet. Try again in a little while."
        : "Could not load today's puzzle. Reload to try again.",
      true,
    );
    submit.disabled = true;
    return;
  }
  renderClues();
  if (!localStorage.getItem("regexle:seen") && game.attempts.length === 0) {
    helpDialog.showModal();
    localStorage.setItem("regexle:seen", "1");
  }
  setTimeout(
    () => showNotice("A new puzzle is ready. Reload to play it.", true),
    msUntilLocalMidnight() + 1000,
  );
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && localIsoDate() !== today) {
      showNotice("A new puzzle is ready. Reload to play it.", true);
    }
  });
}

void start();
