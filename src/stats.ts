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

// Bars for 1 to 6 checks plus a fail row, scaled to the largest count.
export function renderDist(root: HTMLElement, counts: number[], highlight: number | null): void {
  const order = [...Array.from({ length: MAX_ATTEMPTS }, (_, i) => i + 1), 0];
  const max = Math.max(1, ...counts);
  root.replaceChildren(
    ...order.map((k) => {
      const row = document.createElement("div");
      row.className = "dist-row";
      if (k === highlight) row.classList.add("mine");
      const label = document.createElement("span");
      label.className = "dist-label";
      label.textContent = k === 0 ? "X" : String(k);
      const bar = document.createElement("span");
      bar.className = "dist-bar";
      const n = counts[k] ?? 0;
      bar.style.width = `${Math.max(n ? 8 : 0, (n / max) * 100)}%`;
      const count = document.createElement("span");
      count.className = "dist-count";
      count.textContent = String(n);
      row.append(label, bar, count);
      return row;
    }),
  );
}
