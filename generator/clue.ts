import {
  ALPHABET,
  FULL,
  LINE,
  alt,
  bit,
  isLiteral,
  lit,
  maskOf,
  popcount,
  render,
  rep,
  seq,
  set,
  type Node,
} from "../shared/regex/ast.ts";
import { compile, countStrings, matches, support } from "../shared/regex/nfa.ts";
import { parse } from "../shared/regex/parse.ts";
import { chance, int, pick, shuffle, weighted, type Rng } from "./rng.ts";

export const MAX_CLUE_LENGTH = 14;
const MIN_OPEN_POSITIONS = 2;
const MIN_MATCHES = 20;
const MAX_MATCHES = 26 ** LINE / 2;
// Tightness 0 leans on classes, wildcards, and alternations; MAX_TIGHTNESS
// is nearly literal.
export const MAX_TIGHTNESS = 4;

function decoyLetters(rng: Rng, avoid: number, n: number): number {
  const pool = shuffle(
    rng,
    [...ALPHABET].filter((ch) => !(avoid & bit(ch))),
  );
  return maskOf(pool.slice(0, n).join(""));
}

function rangeAround(rng: Rng, letter: string): number {
  const idx = letter.charCodeAt(0) - 65;
  const span = 2 + int(rng, 6);
  const lo = Math.max(0, Math.min(idx - int(rng, span + 1), 25 - span));
  let mask = 0;
  for (let i = lo; i <= lo + span; i++) mask |= 1 << i;
  return mask;
}

function classFor(rng: Rng, letters: string, tight: number): Node {
  const own = maskOf(letters);
  const decoys = Math.max(1, 4 - tight);
  return weighted(rng, [
    [() => set(own | decoyLetters(rng, own, decoys)), 3],
    [() => set(FULL & ~decoyLetters(rng, own, 1 + int(rng, 3 + tight)), true), 1 + tight],
    [
      () => set(letters.length === 1 ? rangeAround(rng, letters) : own | decoyLetters(rng, own, 1)),
      1,
    ],
  ])();
}

function decoyString(rng: Rng, chunk: string): string {
  for (;;) {
    const len = Math.max(1, Math.min(4, chunk.length + int(rng, 3) - 1));
    let s = "";
    for (let i = 0; i < len; i++) {
      s += chance(rng, 0.4) && i < chunk.length ? chunk[i]! : ALPHABET[int(rng, 26)]!;
    }
    if (s !== chunk) return s;
  }
}

const literal = (chunk: string): Node => seq(...[...chunk].map(lit));

function single(rng: Rng, ch: string, tight: number): Node {
  const pLiteral = [0.04, 0.15, 0.35, 0.55, 0.75][tight] ?? 0.75;
  if (chance(rng, pLiteral)) return lit(ch);
  return weighted(rng, [
    [() => set(FULL), tight <= 1 ? 2 : 0.5],
    [() => classFor(rng, ch, tight), 4],
    [
      () =>
        alt(
          lit(ch),
          lit(
            pick(
              rng,
              [...ALPHABET].filter((c) => c !== ch),
            ),
          ),
        ),
      1,
    ],
  ])();
}

function chunkNode(rng: Rng, chunk: string, tight: number): Node {
  if (chunk.length === 1) return single(rng, chunk, tight);
  const k = chunk.length;
  const uniform = new Set(chunk).size === 1;
  return weighted(rng, [
    [() => literal(chunk), tight === 0 ? 0.2 : 2 * tight],
    [() => rep(classFor(rng, chunk, tight), k, k), 2],
    [() => rep(classFor(rng, chunk, tight), 1, Infinity), Math.max(0.3, 2 - tight)],
    [() => rep(classFor(rng, chunk, tight), Math.max(1, k - 1), k + 1), 1],
    [() => rep(set(FULL), k, k), tight <= 1 ? 1 : 0.2],
    [() => alt(literal(chunk), literal(decoyString(rng, chunk))), 2],
    [
      () => alt(literal(chunk), literal(decoyString(rng, chunk)), literal(decoyString(rng, chunk))),
      tight === 0 ? 1 : 0,
    ],
    [
      () =>
        uniform
          ? rep(lit(chunk[0]!), 1, Infinity)
          : seq(single(rng, chunk[0]!, tight), literal(chunk.slice(1))),
      1,
    ],
  ])();
}

function segments(rng: Rng, line: string): string[] {
  const cuts = new Set<number>();
  const n = 1 + int(rng, 3);
  while (cuts.size < n) cuts.add(1 + int(rng, LINE - 1));
  const at = [0, ...[...cuts].sort((a, b) => a - b), LINE];
  const out: string[] = [];
  for (let i = 0; i + 1 < at.length; i++) out.push(line.slice(at[i], at[i + 1]));
  return out;
}

function dotRun(node: Node): number {
  if (node.kind === "set" && node.mask === FULL) return 1;
  if (node.kind === "rep" && node.min === node.max && dotRun(node.item) === 1) return node.min;
  return 0;
}

// Collapses neighbouring wildcards so `..{2}` renders as `.{3}`.
function mergeDots(items: Node[]): Node[] {
  const out: Node[] = [];
  for (const item of items) {
    const run = dotRun(item);
    const prev = out[out.length - 1];
    const prevRun = prev ? dotRun(prev) : 0;
    if (run && prevRun) {
      out[out.length - 1] = rep(set(FULL), run + prevRun, run + prevRun);
    } else {
      out.push(item);
    }
  }
  return out;
}

const flatten = (items: Node[]): Node[] =>
  items.flatMap((item) => (item.kind === "seq" ? flatten(item.items) : [item]));

function candidate(rng: Rng, line: string, tight: number): Node {
  const items: Node[] = [];
  for (const chunk of segments(rng, line)) {
    if (chance(rng, Math.max(0, 0.2 - 0.05 * tight))) {
      items.push(rep(lit(ALPHABET[int(rng, 26)]!), 0, 1));
    }
    items.push(chunkNode(rng, chunk, tight));
  }
  return seq(...mergeDots(flatten(items)));
}

const ALL_LINES_BITS = LINE * Math.log2(26);

// Bits of information a clue gives away on its own, before any crossing:
// how far it narrows the 26^5 possible lines.
export function bits(clue: string): number {
  return ALL_LINES_BITS - Math.log2(countStrings(compile(parse(clue)), LINE));
}

// Positions a clue fixes to one letter on its own. Players fill these in
// first, so they count for more than their bits.
export function pinned(clue: string): number {
  const open = support(compile(parse(clue)), new Array<number>(LINE).fill(FULL));
  return open ? open.filter((m) => popcount(m) === 1).length : 0;
}

export function acceptable(text: string, node: Node, line: string): boolean {
  if (text.length > MAX_CLUE_LENGTH || isLiteral(node)) return false;
  const nfa = compile(node);
  if (!matches(nfa, line)) return false;
  const open = support(nfa, new Array<number>(LINE).fill(FULL));
  if (!open || open.filter((m) => popcount(m) > 1).length < MIN_OPEN_POSITIONS) return false;
  const n = countStrings(nfa, LINE);
  return n >= MIN_MATCHES && n <= MAX_MATCHES;
}

// A regex that matches `line`, rejects every line in `reject`, and admits a
// controlled amount of else. Higher tightness leans on literals and smaller
// classes.
export function synthesise(rng: Rng, line: string, tight: number, reject: string[] = []): string {
  for (let attempt = 0; attempt < 400; attempt++) {
    const node = candidate(rng, line, Math.min(tight, MAX_TIGHTNESS));
    const text = render(node);
    if (!acceptable(text, node, line)) continue;
    const nfa = compile(node);
    if (reject.some((other) => matches(nfa, other))) continue;
    return text;
  }
  throw new Error(`no clue for ${line} at tightness ${tight}`);
}
