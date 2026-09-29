export const PUZZLE_PREFIX = "puzzle:";

export const puzzleKey = (number: number): string => `${PUZZLE_PREFIX}${number}`;

export interface StoredPuzzle {
  number: number;
  rows: string[];
  cols: string[];
  answer: string[];
}
