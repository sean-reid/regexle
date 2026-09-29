import { FULL, lettersOf, popcount, type Node } from "./ast.ts";
import { parse } from "./parse.ts";

const WORDS = ["zero", "one", "two", "three", "four", "five"];
const count = (n: number): string => WORDS[n] ?? String(n);

function list(letters: string, joiner: string): string {
  const items = [...letters];
  if (items.length === 1) return items[0]!;
  if (items.length === 2) return `${items[0]} ${joiner} ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} ${joiner} ${items[items.length - 1]}`;
}

function contiguous(mask: number): boolean {
  const letters = lettersOf(mask);
  return (
    letters.length > 2 &&
    letters.charCodeAt(letters.length - 1) - letters.charCodeAt(0) === letters.length - 1
  );
}

function letterPhrase(node: Extract<Node, { kind: "set" }>, plural: boolean): string {
  const noun = plural ? "letters" : "letter";
  if (node.mask === FULL) return plural ? "any letters" : "any letter";
  if (node.negated)
    return `${plural ? "letters" : "any letter"} except ${list(lettersOf(FULL & ~node.mask), "or")}`;
  if (popcount(node.mask) === 1) return plural ? `${lettersOf(node.mask)}s` : lettersOf(node.mask);
  const letters = lettersOf(node.mask);
  if (contiguous(node.mask))
    return `${plural ? "letters" : "a letter"} from ${letters[0]} to ${letters[letters.length - 1]}`;
  return plural ? `${noun} from ${list(letters, "or")}` : `one of ${list(letters, "or")}`;
}

function describe(node: Node): string {
  switch (node.kind) {
    case "set":
      return letterPhrase(node, false);
    case "seq":
      return node.items.map(describe).join(", then ");
    case "alt":
      return `either ${node.options.map(describe).join(" or ")}`;
    case "rep":
      return repeat(node);
  }
}

function repeat(node: Extract<Node, { kind: "rep" }>): string {
  const { item, min, max } = node;
  if (min === 0 && max === 1) return `optionally ${describe(item)}`;
  if (item.kind === "set") {
    if (min === 0 && max === Infinity)
      return `any number of ${letterPhrase(item, true)}, possibly none`;
    if (min === 1 && max === Infinity) return `one or more ${letterPhrase(item, true)}`;
    if (item.mask === FULL) {
      if (min === max) return `any ${count(min)} letters`;
      if (max === Infinity) return `${count(min)} or more letters`;
      return `${count(min)} to ${count(max)} letters`;
    }
    if (min === max) return `${count(min)} ${letterPhrase(item, min !== 1)}`;
    if (max === Infinity) return `${count(min)} or more ${letterPhrase(item, true)}`;
    return `${count(min)} to ${count(max)} ${letterPhrase(item, true)}`;
  }
  const inner = describe(item);
  if (min === 0 && max === Infinity) return `${inner}, repeated any number of times or not at all`;
  if (min === 1 && max === Infinity) return `${inner}, repeated one or more times`;
  if (min === max) return `${inner}, ${count(min)} times`;
  if (max === Infinity) return `${inner}, ${count(min)} or more times`;
  return `${inner}, ${count(min)} to ${count(max)} times`;
}

// A plain-English reading of a clue, or null when it does not parse.
export function explain(clue: string): string | null {
  try {
    const text = describe(parse(clue));
    return text.charAt(0).toUpperCase() + text.slice(1) + ".";
  } catch {
    return null;
  }
}
