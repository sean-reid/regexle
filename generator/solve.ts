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
}

const CELLS = LINE * LINE;

interface Line {
  nfa: Nfa;
  cells: number[];
}

function lines(clues: Clues): Line[] {
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
  if (!propagate(all, dom)) return { solutions, fixed: 0 };
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
  return { solutions, fixed };
}
