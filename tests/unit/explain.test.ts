import { describe, expect, it } from "vitest";
import { explain } from "../../shared/regex/explain.ts";

describe("explain", () => {
  it.each([
    ["ABCDE", "A, then B, then C, then D, then E."],
    ["A.C.E", "A, then any letter, then C, then any letter, then E."],
    ["[AEIOU]{2}[^X]+", "Two letters from A, E, I, O or U, then one or more letters except X."],
    ["(AB|BA).", "Either A, then B or B, then A, then any letter."],
    ["[A-H]Z*", "A letter from A to H, then any number of Zs, possibly none."],
    ["Q?ABCD", "Optionally Q, then A, then B, then C, then D."],
    [".{3}[^QZ]{1,2}", "Any three letters, then one to two letters except Q or Z."],
    [".{2,}", "Two or more letters."],
    ["(AB){2}C", "A, then B, two times, then C."],
    ["[BD]{2,}E", "Two or more letters from B or D, then E."],
  ])("%s", (clue, english) => {
    expect(explain(clue)).toBe(english);
  });

  it("returns null for a clue it cannot parse", () => {
    expect(explain("(")).toBeNull();
  });
});
