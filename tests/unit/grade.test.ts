import { describe, expect, it } from "vitest";
import { allGreen, grade, isGrid } from "../../shared/grade.ts";

const answer = ["ABCDE", "FGHIJ", "KLMNO", "PQRST", "UVWXY"];

describe("grade", () => {
  it("marks a perfect grid all green", () => {
    const marks = grade(answer, answer);
    expect(marks).toEqual(["ggggg", "ggggg", "ggggg", "ggggg", "ggggg"]);
    expect(allGreen(marks)).toBe(true);
  });

  it("marks a letter from the same row or column yellow", () => {
    const guess = ["BACDE", "FGHIJ", "KLMNO", "PQRST", "UVWXY"];
    expect(grade(answer, guess)[0]).toBe("yyggg");
    const column = ["FBCDE", "AGHIJ", "KLMNO", "PQRST", "UVWXY"];
    expect(
      grade(answer, column)
        .map((row) => row[0])
        .join(""),
    ).toBe("yyggg");
  });

  it("marks a letter from elsewhere in the grid grey", () => {
    const guess = ["YBCDE", "FGHIJ", "KLMNO", "PQRST", "UVWXA"];
    const marks = grade(answer, guess);
    expect(marks[0]).toBe("xgggg");
    expect(marks[4]).toBe("ggggx");
    expect(allGreen(marks)).toBe(false);
  });

  it("does not count the cell itself as elsewhere", () => {
    const guess = ["ZBCDE", "FGHIJ", "KLMNO", "PQRST", "UVWXY"];
    expect(grade(answer, guess)[0]).toBe("xgggg");
  });
});

describe("isGrid", () => {
  it("accepts five rows of five capitals", () => {
    expect(isGrid(answer)).toBe(true);
  });
  it.each([
    [["ABCDE"]],
    [["abcde", "FGHIJ", "KLMNO", "PQRST", "UVWXY"]],
    [["ABCD", "FGHIJ", "KLMNO", "PQRST", "UVWXY"]],
    [["ABCDE", "FGHIJ", "KLMNO", "PQRST", 5]],
    ["ABCDE"],
    [null],
  ])("rejects %j", (raw) => {
    expect(isGrid(raw)).toBe(false);
  });
});
