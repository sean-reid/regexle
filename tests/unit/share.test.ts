import { describe, expect, it } from "vitest";
import { shareText } from "../../src/share";

const grid = ["AAAAA", "AAAAA", "AAAAA", "AAAAA", "AAAAA"];

describe("shareText", () => {
  it("colours each cell by the check on which it first came right", () => {
    const attempts = [
      { grid, marks: ["gxxxx", "xxxxx", "xxxxx", "xxxxx", "xxxxg"] },
      { grid, marks: ["ggxxx", "xxxxx", "xxxxx", "xxxxx", "xxxxg"] },
      { grid, marks: ["gggxx", "xxxxx", "xxxxx", "xxxxx", "xxxxg"] },
      { grid, marks: ["ggggx", "xxxxx", "xxxxx", "xxxxx", "xxxxg"] },
      { grid, marks: ["ggggg", "ggggg", "ggggg", "ggggg", "ggggg"] },
    ];
    const lines = shareText(12, attempts, true, false).split("\n");
    expect(lines[0]).toBe("regexle No. 12  5/6");
    expect(lines[2]).toBe("\u{1F7E9}\u{1F7E8}\u{1F7E7}\u{1F7E5}\u{1F7E5}");
    expect(lines[3]).toBe("\u{1F7E5}".repeat(5));
    expect(lines[6]).toBe("\u{1F7E5}".repeat(4) + "\u{1F7E9}");
  });

  it("scores a loss as X and uses black squares in dark mode", () => {
    const attempts = Array.from({ length: 6 }, () => ({
      grid,
      marks: ["xxxxx", "xxxxx", "xxxxx", "xxxxx", "xxxxx"],
    }));
    const text = shareText(3, attempts, false, true);
    expect(text.startsWith("regexle No. 3  X/6\n\n")).toBe(true);
    expect(text.split("\n")).toHaveLength(7);
    expect(text.endsWith("⬛".repeat(5))).toBe(true);
  });
});
