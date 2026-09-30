import { MAX_ATTEMPTS } from "../shared/api";
import type { Record } from "./state";

export function renderFigures(root: HTMLElement, record: Record, streak: number): void {
  const rate = record.played ? Math.round((record.won / record.played) * 100) : 0;
  const rows: [string, string][] = [
    ["Played", String(record.played)],
    ["Solved", `${rate}%`],
    ["Streak", String(streak)],
    ["Best", String(record.maxStreak)],
  ];
  root.replaceChildren(
    ...rows.flatMap(([label, value]) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      return [dd, dt];
    }),
  );
}

// One row per outcome, 1 to 6 checks then a fail, with your bar over
// everyone's and the numbers in two columns beside them. Each series scales
// to its own largest count; everyone's number is a share of the day's games.
export function renderDist(
  root: HTMLElement,
  mine: number[],
  all: number[] | null,
  highlight: number | null,
): void {
  const order = [...Array.from({ length: MAX_ATTEMPTS }, (_, i) => i + 1), 0];
  const mineMax = Math.max(1, ...mine);
  const allMax = Math.max(1, ...(all ?? []));
  const allTotal = (all ?? []).reduce((a, b) => a + b, 0);
  root.replaceChildren(
    ...order.map((k) => {
      const row = document.createElement("div");
      row.className = "dist-row";
      if (k === highlight) row.classList.add("today");
      const n = mine[k] ?? 0;
      const m = all?.[k] ?? 0;
      row.append(
        span("dist-label", k === 0 ? "X" : String(k)),
        bars(n / mineMax, all ? m / allMax : null),
        span("dist-count mine", String(n)),
        span("dist-count all", all ? `${allTotal ? Math.round((m / allTotal) * 100) : 0}%` : ""),
      );
      return row;
    }),
  );
}

function span(className: string, text: string): HTMLElement {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = text;
  return el;
}

function bars(mine: number, all: number | null): HTMLElement {
  const wrap = document.createElement("span");
  wrap.className = "dist-bars";
  const fill = (kind: string, fraction: number) => {
    const bar = document.createElement("span");
    bar.className = `dist-bar ${kind}`;
    bar.style.width = `${Math.max(fraction > 0 ? 3 : 0, fraction * 100)}%`;
    return bar;
  };
  wrap.append(fill("mine", mine));
  if (all !== null) wrap.append(fill("all", all));
  return wrap;
}
