export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const FULL = (1 << 26) - 1;
export const LINE = 5;

export type Node =
  | { kind: "set"; mask: number; negated: boolean }
  | { kind: "seq"; items: Node[] }
  | { kind: "alt"; options: Node[] }
  | { kind: "rep"; item: Node; min: number; max: number };

export const bit = (letter: string): number => 1 << (letter.charCodeAt(0) - 65);

export function maskOf(letters: string): number {
  let m = 0;
  for (const ch of letters) m |= bit(ch);
  return m;
}

export function lettersOf(mask: number): string {
  let out = "";
  for (let i = 0; i < 26; i++) if (mask & (1 << i)) out += ALPHABET[i];
  return out;
}

export function popcount(mask: number): number {
  let n = 0;
  for (let m = mask; m; m &= m - 1) n++;
  return n;
}

export const set = (mask: number, negated = false): Node => ({ kind: "set", mask, negated });
export const lit = (letter: string): Node => set(bit(letter));
export const seq = (...items: Node[]): Node =>
  items.length === 1 ? items[0]! : { kind: "seq", items };
export const alt = (...options: Node[]): Node => ({ kind: "alt", options });
export const rep = (item: Node, min: number, max: number): Node => ({
  kind: "rep",
  item,
  min,
  max,
});

function classBody(mask: number): string {
  let out = "";
  let i = 0;
  while (i < 26) {
    if (!(mask & (1 << i))) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < 26 && mask & (1 << (j + 1))) j++;
    out +=
      j - i >= 2
        ? `${ALPHABET[i]}-${ALPHABET[j]}`
        : lettersOf(mask & (((1 << (j + 1)) - 1) ^ ((1 << i) - 1)));
    i = j + 1;
  }
  return out;
}

function renderSet(node: Extract<Node, { kind: "set" }>): string {
  if (node.mask === FULL) return ".";
  if (node.negated) return `[^${classBody(FULL & ~node.mask)}]`;
  if (popcount(node.mask) === 1) return lettersOf(node.mask);
  return `[${classBody(node.mask)}]`;
}

function quantifier(min: number, max: number): string {
  if (min === 0 && max === 1) return "?";
  if (min === 0 && max === Infinity) return "*";
  if (min === 1 && max === Infinity) return "+";
  if (min === max) return `{${min}}`;
  if (max === Infinity) return `{${min},}`;
  return `{${min},${max}}`;
}

export function render(node: Node): string {
  switch (node.kind) {
    case "set":
      return renderSet(node);
    case "seq":
      return node.items.map(render).join("");
    case "alt":
      return `(${node.options.map(render).join("|")})`;
    case "rep": {
      const inner = render(node.item);
      const atomic = node.item.kind === "set" || node.item.kind === "alt";
      return `${atomic ? inner : `(${inner})`}${quantifier(node.min, node.max)}`;
    }
  }
}

export function isLiteral(node: Node): boolean {
  switch (node.kind) {
    case "set":
      return popcount(node.mask) === 1;
    case "seq":
      return node.items.every(isLiteral);
    default:
      return false;
  }
}
