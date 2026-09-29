import { LINE } from "./regex/ast.ts";
import type { Mark } from "./api.ts";

export const GRID_SHAPE = new RegExp(`^[A-Z]{${LINE}}$`);

export function isGrid(raw: unknown): raw is string[] {
  return (
    Array.isArray(raw) &&
    raw.length === LINE &&
    raw.every((row) => typeof row === "string" && GRID_SHAPE.test(row))
  );
}

// Green where the letter is right, yellow where the answer has that letter
// elsewhere in the same row or column, grey otherwise.
export function grade(answer: string[], guess: string[]): string[] {
  const marks: string[] = [];
  for (let r = 0; r < LINE; r++) {
    let row = "";
    for (let c = 0; c < LINE; c++) {
      const letter = guess[r]![c]!;
      let mark: Mark = "x";
      if (answer[r]![c] === letter) {
        mark = "g";
      } else {
        for (let k = 0; k < LINE; k++) {
          if ((k !== c && answer[r]![k] === letter) || (k !== r && answer[k]![c] === letter)) {
            mark = "y";
            break;
          }
        }
      }
      row += mark;
    }
    marks.push(row);
  }
  return marks;
}

export const allGreen = (marks: string[]): boolean => marks.every((row) => /^g+$/.test(row));
