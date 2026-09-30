import { MAX_ATTEMPTS } from "../shared/api";
import { LINE } from "../shared/regex/ast";
import type { Attempt } from "./state";

// Cell colour by the check number on which it came right: check 1 green,
// 2 yellow, 3 orange, 4 and later red.
const PLACED = ["\u{1F7E9}", "\u{1F7E8}", "\u{1F7E7}", "\u{1F7E5}"];

// One grid the shape of the puzzle. Each cell shows when it was placed, or
// stays blank if it never was.
export function shareText(
  number: number,
  attempts: Attempt[],
  won: boolean,
  dark: boolean,
): string {
  const never = dark ? "\u2B1B" : "\u2B1C";
  const score = won ? String(attempts.length) : "X";
  const rows: string[] = [];
  for (let r = 0; r < LINE; r++) {
    let row = "";
    for (let c = 0; c < LINE; c++) {
      const first = attempts.findIndex((attempt) => attempt.marks[r]?.[c] === "g");
      row += first === -1 ? never : PLACED[Math.min(first, PLACED.length - 1)]!;
    }
    rows.push(row);
  }
  return [`regexle No. ${number}  ${score}/${MAX_ATTEMPTS}`, "", ...rows].join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    let ok: boolean;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}
