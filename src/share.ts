import { MAX_ATTEMPTS } from "../shared/api";
import type { Attempt } from "./state";

const SQUARES = {
  normal: { g: "\u{1F7E9}", y: "\u{1F7E8}" },
  contrast: { g: "\u{1F7E6}", y: "\u{1F7E7}" },
};

export function shareText(
  number: number,
  attempts: Attempt[],
  won: boolean,
  contrast: boolean,
  dark: boolean,
): string {
  const set = contrast ? SQUARES.contrast : SQUARES.normal;
  const miss = dark ? "⬛" : "⬜";
  const score = won ? String(attempts.length) : "X";
  const last = attempts[attempts.length - 1];
  const rows = last
    ? last.marks.map((row) =>
        [...row].map((m) => (m === "g" ? set.g : m === "y" ? set.y : miss)).join(""),
      )
    : [];
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
