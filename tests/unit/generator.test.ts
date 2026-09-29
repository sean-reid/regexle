import { describe, expect, it } from "vitest";
import { generatePuzzle, giveaway } from "../../generator/generate.ts";
import { MAX_CLUE_LENGTH, synthesise } from "../../generator/clue.ts";
import { seeded } from "../../generator/rng.ts";
import { solve } from "../../generator/solve.ts";

const js = (src: string) => new RegExp(`^(?:${src})$`);

describe("solve", () => {
  it("finds the single grid pinned by literal clues", () => {
    const rows = ["ABCDE", "FGHIJ", "KLMNO", "PQRST", "UVWXY"];
    const cols = ["AFKPU", "BGLQV", "CHMRW", "DINSX", "EJOTY"];
    const result = solve({ rows, cols });
    expect(result.solutions).toEqual([rows]);
    expect(result.fixed).toBe(25);
  });

  it("stops at two grids when the clues are loose", () => {
    const rows = ["ABCD[EF]", "FGHIJ", "KLMNO", "PQRST", "UVWXY"];
    const cols = ["AFKPU", "BGLQV", "CHMRW", "DINSX", "[EF]JOTY"];
    const result = solve({ rows, cols });
    expect(result.solutions).toHaveLength(2);
    expect(result.fixed).toBe(24);
    expect(result.open).toBe(1);
    expect(result.maxCandidates).toBe(2);
  });

  it("reports nothing when a clue contradicts another", () => {
    const rows = ["ABCDE", "FGHIJ", "KLMNO", "PQRST", "UVWXY"];
    const cols = ["ZFKPU", "BGLQV", "CHMRW", "DINSX", "EJOTY"];
    expect(solve({ rows, cols }).solutions).toEqual([]);
  });
});

describe("synthesise", () => {
  it("writes clues that match their line and reject the alternatives", () => {
    const rng = seeded("synth");
    for (let i = 0; i < 50; i++) {
      const line = "QUARK";
      const other = "QUIRK";
      const clue = synthesise(rng, line, i % 4, [other]);
      expect(clue.length).toBeLessThanOrEqual(MAX_CLUE_LENGTH);
      expect(js(clue).test(line), clue).toBe(true);
      expect(js(clue).test(other), clue).toBe(false);
      expect(clue).not.toBe(line);
    }
  });
});

describe("generatePuzzle", () => {
  const puzzles = Array.from({ length: 12 }, (_, i) => generatePuzzle("test-seed", i + 1));

  it("numbers puzzles as asked", () => {
    expect(puzzles.map((p) => p.number)).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
  });

  it("produces clues the platform engine agrees match the answer", () => {
    for (const p of puzzles) {
      p.rows.forEach((clue, r) =>
        expect(js(clue).test(p.answer[r]!), `${p.number} row ${r}`).toBe(true),
      );
      p.cols.forEach((clue, c) => {
        const col = p.answer.map((row) => row[c]).join("");
        expect(js(clue).test(col), `${p.number} col ${c}`).toBe(true);
      });
    }
  });

  it("leaves a few cells open with the answer among the fitting grids", () => {
    for (const p of puzzles) {
      const result = solve({ rows: p.rows, cols: p.cols }, 1000);
      expect(result.solutions.length, `puzzle ${p.number}`).toBeGreaterThanOrEqual(4);
      expect(result.solutions.length, `puzzle ${p.number}`).toBeLessThanOrEqual(40);
      expect(result.solutions, `puzzle ${p.number}`).toContainEqual(p.answer);
      expect(result.open, `puzzle ${p.number}`).toBeGreaterThanOrEqual(3);
      expect(result.maxCandidates, `puzzle ${p.number}`).toBeLessThanOrEqual(4);
    }
  });

  it("keeps every clue within the length cap", () => {
    for (const p of puzzles) {
      for (const clue of [...p.rows, ...p.cols])
        expect(clue.length).toBeLessThanOrEqual(MAX_CLUE_LENGTH);
    }
  });

  it("gives away little on its own and never leaves loose wildcards", () => {
    const mean =
      puzzles.reduce((sum, p) => sum + giveaway([...p.rows, ...p.cols]), 0) / puzzles.length;
    expect(mean).toBeLessThan(200);
    for (const p of puzzles) {
      for (const clue of [...p.rows, ...p.cols]) expect(clue).not.toMatch(/\.\./);
    }
  });

  it("is deterministic for a seed and differs across seeds", () => {
    expect(generatePuzzle("test-seed", 3)).toEqual(puzzles[2]);
    expect(generatePuzzle("another", 3).answer).not.toEqual(puzzles[2]!.answer);
  });
});
