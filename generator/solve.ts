import { FULL, LINE, lettersOf, popcount } from "../shared/regex/ast.ts";
import { compile, support, type Nfa } from "../shared/regex/nfa.ts";
import { parse } from "../shared/regex/parse.ts";

export interface Clues {
  rows: string[];
  cols: string[];
}

export interface Solved {
  solutions: string[][];
  fixed: number;
  // Cells whose letter differs between the solutions found, and the most
  // candidate letters any one of them has.
  open: number;
  maxCandidates: number;
}

const CELLS = LINE * LINE;

interface Line {
  nfa: Nfa;
  cells: number[];
}

const compiled = new Map<string, Line[]>();

function lines(clues: Clues): Line[] {
  const key = [...clues.rows, ...clues.cols].join("\u0000");
  const hit = compiled.get(key);
  if (hit) return hit;
  const built = buildLines(clues);
  if (compiled.size > 5000) compiled.clear();
  compiled.set(key, built);
  return built;
}

function buildLines(clues: Clues): Line[] {
  const out: Line[] = [];
  for (let r = 0; r < LINE; r++) {
    const cells: number[] = [];
    for (let c = 0; c < LINE; c++) cells.push(r * LINE + c);
    out.push({ nfa: compile(parse(clues.rows[r]!)), cells });
  }
  for (let c = 0; c < LINE; c++) {
    const cells: number[] = [];
    for (let r = 0; r < LINE; r++) cells.push(r * LINE + c);
    out.push({ nfa: compile(parse(clues.cols[c]!)), cells });
  }
  return out;
}

function propagate(all: Line[], dom: Int32Array): boolean {
  let changed = true;
  while (changed) {
    changed = false;
    for (const line of all) {
      const before = line.cells.map((i) => dom[i]!);
      const after = support(line.nfa, before);
      if (!after) return false;
      for (let k = 0; k < LINE; k++) {
        if (after[k] !== before[k]) {
          dom[line.cells[k]!] = after[k]!;
          changed = true;
        }
      }
    }
  }
  return true;
}

export function propagateClues(clues: Clues, dom: Int32Array): boolean {
  return propagate(lines(clues), dom);
}

// One grid consistent with the clues and the given cell domains, trying
// letters in alphabetical or reverse order.
export function solveFrom(clues: Clues, start: Int32Array, reverse = false): string[] | null {
  const all = lines(clues);
  const search = (d: Int32Array): string[] | null => {
    let best = -1;
    let bestSize = 27;
    for (let i = 0; i < CELLS; i++) {
      const size = popcount(d[i]!);
      if (size > 1 && size < bestSize) {
        best = i;
        bestSize = size;
      }
    }
    if (best === -1) return gridOf(d);
    for (let k = 0; k < 26; k++) {
      const c = reverse ? 25 - k : k;
      const b = 1 << c;
      if (!(d[best]! & b)) continue;
      const next = new Int32Array(d);
      next[best] = b;
      if (propagate(all, next)) {
        const found = search(next);
        if (found) return found;
      }
    }
    return null;
  };
  const dom = new Int32Array(start);
  return propagate(all, dom) ? search(dom) : null;
}

function gridOf(dom: Int32Array): string[] {
  const rows: string[] = [];
  for (let r = 0; r < LINE; r++) {
    let row = "";
    for (let c = 0; c < LINE; c++) row += lettersOf(dom[r * LINE + c]!);
    rows.push(row);
  }
  return rows;
}

// Finds up to `limit` grids satisfying every clue. `fixed` is how many cells
// the clues pin down before any guessing, a rough measure of the foothold a
// player has.
export function solve(clues: Clues, limit = 2): Solved {
  const all = lines(clues);
  const dom = new Int32Array(CELLS).fill(FULL);
  const solutions: string[][] = [];
  if (!propagate(all, dom)) return { solutions, fixed: 0, open: 0, maxCandidates: 0 };
  let fixed = 0;
  for (let i = 0; i < CELLS; i++) if (popcount(dom[i]!) === 1) fixed++;

  const search = (d: Int32Array): void => {
    if (solutions.length >= limit) return;
    let best = -1;
    let bestSize = 27;
    for (let i = 0; i < CELLS; i++) {
      const size = popcount(d[i]!);
      if (size > 1 && size < bestSize) {
        best = i;
        bestSize = size;
      }
    }
    if (best === -1) {
      solutions.push(gridOf(d));
      return;
    }
    for (let c = 0; c < 26; c++) {
      const b = 1 << c;
      if (!(d[best]! & b)) continue;
      const next = new Int32Array(d);
      next[best] = b;
      if (propagate(all, next)) search(next);
      if (solutions.length >= limit) return;
    }
  };
  search(dom);
  return { solutions, fixed, ...spread(solutions) };
}

function spread(solutions: string[][]): { open: number; maxCandidates: number } {
  let open = 0;
  let maxCandidates = 0;
  for (let r = 0; r < LINE; r++) {
    for (let c = 0; c < LINE; c++) {
      const letters = new Set(solutions.map((g) => g[r]![c]!));
      if (letters.size > 1) open++;
      maxCandidates = Math.max(maxCandidates, letters.size);
    }
  }
  return { open, maxCandidates };
}
