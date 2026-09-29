import { ALPHABET, LINE } from "../shared/regex/ast.ts";
import { MAX_TIGHTNESS, synthesise } from "./clue.ts";
import { int, seeded, shuffle, type Rng } from "./rng.ts";
import { solve, type Clues } from "./solve.ts";

export interface Puzzle {
  number: number;
  rows: string[];
  cols: string[];
  answer: string[];
}

const MAX_GRIDS = 20;
const MAX_TIGHTEN = 40;
const CANDIDATES_PER_STEP = 3;

function randomGrid(rng: Rng): string[] {
  const rows: string[] = [];
  for (let r = 0; r < LINE; r++) {
    let row = "";
    for (let c = 0; c < LINE; c++) row += ALPHABET[int(rng, 26)];
    rows.push(row);
  }
  return rows;
}

function lineText(rows: string[], index: number): string {
  if (index < LINE) return rows[index]!;
  return rows.map((row) => row[index - LINE]!).join("");
}

function cellsOf(index: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < LINE; k++) {
    out.push(index < LINE ? index * LINE + k : k * LINE + (index - LINE));
  }
  return out;
}

const asClues = (clues: string[]): Clues => ({
  rows: clues.slice(0, LINE),
  cols: clues.slice(LINE),
});

// The clue covering the most cells where a rival grid disagrees with the
// answer is the one letting the rival through.
function loosestLine(rng: Rng, answer: string[], rival: string[]): number {
  const differs = new Set<number>();
  for (let r = 0; r < LINE; r++) {
    for (let c = 0; c < LINE; c++) if (answer[r]![c] !== rival[r]![c]) differs.add(r * LINE + c);
  }
  let best: number[] = [];
  let bestScore = -1;
  for (let i = 0; i < 2 * LINE; i++) {
    const score = cellsOf(i).filter((cell) => differs.has(cell)).length;
    if (score > bestScore) {
      bestScore = score;
      best = [i];
    } else if (score === bestScore) {
      best.push(i);
    }
  }
  return best[int(rng, best.length)]!;
}

// Tight clues that admit only the answer. Fails only when a grid resists.
function uniqueStart(rng: Rng, answer: string[]): string[] | null {
  const clues: string[] = [];
  for (let i = 0; i < 2 * LINE; i++)
    clues.push(synthesise(rng, lineText(answer, i), MAX_TIGHTNESS));
  for (let round = 0; round < MAX_TIGHTEN; round++) {
    const { solutions } = solve(asClues(clues), 2);
    if (solutions.length === 0) throw new Error("clues exclude their own answer");
    if (solutions.length === 1) return clues;
    const rival = solutions[0]!.join("") === answer.join("") ? solutions[1]! : solutions[0]!;
    const i = loosestLine(rng, answer, rival);
    clues[i] = synthesise(rng, lineText(answer, i), MAX_TIGHTNESS, [lineText(rival, i)]);
  }
  return null;
}

// Loosens one clue at a time, keeping a change only while the grid stays
// unique. The result is the loosest clue set that still has one answer.
function attempt(rng: Rng): Puzzle | null {
  const answer = randomGrid(rng);
  const clues = uniqueStart(rng, answer);
  if (!clues) return null;
  const tightness = new Array<number>(2 * LINE).fill(MAX_TIGHTNESS);

  for (let level = MAX_TIGHTNESS; level > 0; level--) {
    const order = shuffle(
      rng,
      Array.from({ length: 2 * LINE }, (_, k) => k),
    );
    for (const i of order) {
      if (tightness[i]! < level) continue;
      for (let k = 0; k < CANDIDATES_PER_STEP; k++) {
        const trial = [...clues];
        trial[i] = synthesise(rng, lineText(answer, i), level - 1);
        if (solve(asClues(trial), 2).solutions.length === 1) {
          clues[i] = trial[i]!;
          tightness[i] = level - 1;
          break;
        }
      }
    }
  }
  return { number: 0, ...asClues(clues), answer };
}

export function generatePuzzle(secret: string, number: number): Puzzle {
  const rng = seeded(`${secret}:${number}`);
  for (let grid = 0; grid < MAX_GRIDS; grid++) {
    const puzzle = attempt(rng);
    if (puzzle) return { ...puzzle, number };
  }
  throw new Error(`no puzzle for number ${number}`);
}
