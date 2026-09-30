import { grade } from "../shared/grade.ts";
import { FULL, LINE, bit } from "../shared/regex/ast.ts";
import { propagateClues, solveFrom, type Clues } from "./solve.ts";

const CELLS = LINE * LINE;

// Applies one check's colours to the cell domains. Green fixes the cell,
// grey removes the letter from its whole row and column, amber removes it
// from that cell only.
function applyMarks(dom: Int32Array, guess: string[], marks: string[]): void {
  for (let r = 0; r < LINE; r++) {
    for (let c = 0; c < LINE; c++) {
      const letter = bit(guess[r]![c]!);
      const mark = marks[r]![c];
      const i = r * LINE + c;
      if (mark === "g") {
        dom[i] = letter;
      } else if (mark === "x") {
        for (let k = 0; k < LINE; k++) {
          dom[r * LINE + k]! &= ~letter;
          dom[k * LINE + c]! &= ~letter;
        }
      } else {
        dom[i]! &= ~letter;
      }
    }
  }
}

// Checks a strong player needs: each turn they submit a grid consistent
// with the clues and everything the colours have shown, then prune with the
// new colours. Returns Infinity when the player runs out of consistent
// grids, which means the clues contradict the answer.
export function checksToSolve(clues: Clues, answer: string[], reverse = false, cap = 8): number {
  const dom = new Int32Array(CELLS).fill(FULL);
  for (let turn = 1; turn <= cap; turn++) {
    if (!propagateClues(clues, dom)) return Infinity;
    const guess = solveFrom(clues, dom, reverse);
    if (!guess) return Infinity;
    const marks = grade(answer, guess);
    if (marks.every((row) => row === "ggggg")) return turn;
    applyMarks(dom, guess, marks);
  }
  return Infinity;
}
