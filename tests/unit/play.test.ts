import { describe, expect, it } from "vitest";
import { checksToSolve } from "../../generator/play.ts";

const answer = ["ABCDE", "FGHIJ", "KLMNO", "PQRST", "UVWXY"];
const cols = ["AFKPU", "BGLQV", "CHMRW", "DINSX", "EJOTY"];

describe("checksToSolve", () => {
  it("takes one check when the clues pin the grid", () => {
    expect(checksToSolve({ rows: answer, cols }, answer)).toBe(1);
  });

  it("takes two checks when one cell has two letters in play", () => {
    const rows = ["ABCD[EZ]", "FGHIJ", "KLMNO", "PQRST", "UVWXY"];
    const open = ["AFKPU", "BGLQV", "CHMRW", "DINSX", "[EZ]JOTY"];
    expect(checksToSolve({ rows, cols: open }, answer)).toBeLessThanOrEqual(2);
    expect(checksToSolve({ rows, cols: open }, answer, true)).toBeLessThanOrEqual(2);
  });

  it("uses grey to clear a letter from the whole row and column", () => {
    const rows = ["[AZ]BCDE", "FGHIJ", "KLMNO", "PQRST", "UVWXY"];
    const open = ["[AZ]FKPU", "BGLQV", "CHMRW", "DINSX", "EJOTY"];
    expect(checksToSolve({ rows, cols: open }, answer, true)).toBe(2);
  });

  it("gives up when the clues exclude the answer", () => {
    const rows = ["ZBCDE", "FGHIJ", "KLMNO", "PQRST", "UVWXY"];
    expect(checksToSolve({ rows, cols }, answer)).toBe(Infinity);
  });
});
