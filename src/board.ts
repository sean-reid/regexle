import type { Mark } from "../shared/api";
import { LINE } from "../shared/regex/ast";

export const CELLS = LINE * LINE;
const MARK_NAME: Record<Mark, string> = { g: "right", y: "elsewhere in this line", x: "not here" };
const FLIP_STEP_MS = 35;
const FLIP_MS = 480;

export class Board {
  readonly letters: string[] = new Array<string>(CELLS).fill("");
  readonly marks: (Mark | null)[] = new Array<Mark | null>(CELLS).fill(null);
  active = 0;
  locked = false;
  onActive: (index: number) => void = () => undefined;
  private readonly cells: HTMLButtonElement[] = [];
  private answer: string[] | null = null;

  constructor(private readonly root: HTMLElement) {
    for (let i = 0; i < CELLS; i++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.addEventListener("click", () => this.setActive(i));
      root.append(cell);
      this.cells.push(cell);
    }
    this.render();
  }

  setActive(index: number): void {
    if (index < 0 || index >= CELLS) return;
    this.active = index;
    this.render();
    this.onActive(index);
  }

  move(dr: number, dc: number): void {
    const r = Math.floor(this.active / LINE) + dr;
    const c = (this.active % LINE) + dc;
    if (r < 0 || r >= LINE || c < 0 || c >= LINE) return;
    this.setActive(r * LINE + c);
  }

  type(letter: string): void {
    if (this.locked) return;
    this.letters[this.active] = letter;
    this.marks[this.active] = null;
    if (this.active < CELLS - 1) this.setActive(this.active + 1);
    else this.render();
  }

  backspace(): void {
    if (this.locked) return;
    if (!this.letters[this.active] && this.active > 0) this.active -= 1;
    this.letters[this.active] = "";
    this.marks[this.active] = null;
    this.render();
    this.onActive(this.active);
  }

  load(grid: string[], marks: string[] | null): void {
    for (let i = 0; i < CELLS; i++) {
      const ch = grid[Math.floor(i / LINE)]?.[i % LINE] ?? " ";
      this.letters[i] = ch === " " ? "" : ch;
      const m = marks?.[Math.floor(i / LINE)]?.[i % LINE];
      this.marks[i] = m === "g" || m === "y" || m === "x" ? m : null;
    }
    this.render();
  }

  draft(): string[] {
    const rows: string[] = [];
    for (let r = 0; r < LINE; r++) {
      rows.push(
        this.letters
          .slice(r * LINE, r * LINE + LINE)
          .map((ch) => ch || " ")
          .join(""),
      );
    }
    return rows;
  }

  grid(): string[] | null {
    return this.letters.every(Boolean) ? this.draft() : null;
  }

  showAnswer(answer: string[]): void {
    this.answer = answer;
    this.locked = true;
    this.render();
  }

  shake(): void {
    this.root.classList.remove("shake");
    void this.root.offsetWidth;
    this.root.classList.add("shake");
  }

  focus(): void {
    this.cells[this.active]?.focus({ preventScroll: true });
  }

  // Turns each cell over in reading order and settles it on its mark.
  reveal(marks: string[], instant: boolean): Promise<void> {
    const flat = marks.join("");
    if (instant) {
      for (let i = 0; i < CELLS; i++) this.marks[i] = flat[i] as Mark;
      this.render();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      for (let i = 0; i < CELLS; i++) {
        const cell = this.cells[i]!;
        setTimeout(() => cell.classList.add("flip"), i * FLIP_STEP_MS);
        setTimeout(
          () => {
            this.marks[i] = flat[i] as Mark;
            this.paint(i);
          },
          i * FLIP_STEP_MS + FLIP_MS / 2,
        );
        setTimeout(() => cell.classList.remove("flip"), i * FLIP_STEP_MS + FLIP_MS);
      }
      setTimeout(resolve, (CELLS - 1) * FLIP_STEP_MS + FLIP_MS);
    });
  }

  private paint(i: number): void {
    const cell = this.cells[i]!;
    const r = Math.floor(i / LINE);
    const c = i % LINE;
    const letter = this.letters[i] ?? "";
    const mark = this.marks[i];
    const revealed = this.answer && this.answer[r]?.[c] !== letter;
    cell.textContent = revealed ? (this.answer?.[r]?.[c] ?? "") : letter;
    cell.className = "cell";
    if (mark && !revealed) cell.classList.add(mark);
    if (revealed) cell.classList.add("answer");
    if (i === this.active && !this.locked) cell.classList.add("active");
    cell.tabIndex = i === this.active ? 0 : -1;
    cell.setAttribute(
      "aria-label",
      `Row ${r + 1}, column ${c + 1}, ${letter || "empty"}${mark ? `, ${MARK_NAME[mark]}` : ""}`,
    );
  }

  render(): void {
    for (let i = 0; i < CELLS; i++) this.paint(i);
  }
}
