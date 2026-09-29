const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

export type Key = "Enter" | "Backspace" | (string & { length: 1 });

export function buildKeyboard(root: HTMLElement, onKey: (key: string) => void): void {
  ROWS.forEach((letters, rowIndex) => {
    const row = document.createElement("div");
    row.className = "key-row";
    if (rowIndex === ROWS.length - 1) row.append(makeKey("Enter", "check", "wide", onKey));
    for (const letter of letters) row.append(makeKey(letter, letter, "", onKey));
    if (rowIndex === ROWS.length - 1) row.append(makeKey("Backspace", "delete", "wide", onKey));
    root.append(row);
  });
}

function makeKey(
  key: string,
  label: string,
  extra: string,
  onKey: (key: string) => void,
): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `key ${extra}`.trim();
  b.textContent = label;
  b.dataset.key = key;
  b.setAttribute(
    "aria-label",
    key === "Enter" ? "Check grid" : key === "Backspace" ? "Delete" : key,
  );
  b.addEventListener("pointerdown", (e) => e.preventDefault());
  b.addEventListener("click", () => onKey(key));
  return b;
}

export function bindPhysicalKeys(
  onKey: (key: string) => void,
  onMove: (dr: number, dc: number) => void,
): void {
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (document.querySelector("dialog[open]")) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
    };
    const arrow = arrows[e.key];
    if (arrow) {
      e.preventDefault();
      onMove(arrow[0], arrow[1]);
      return;
    }
    if (e.key === "Enter" || e.key === "Backspace") {
      e.preventDefault();
      onKey(e.key);
      return;
    }
    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      onKey(e.key.toUpperCase());
    }
  });
}
