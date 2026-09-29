import type { Node } from "./ast.ts";

interface State {
  eps: number[];
  mask: number;
  to: number;
}

export interface Nfa {
  states: State[];
  start: number;
  accept: number;
}

interface Frag {
  start: number;
  end: number;
}

class Builder {
  readonly states: State[] = [];

  add(): number {
    this.states.push({ eps: [], mask: 0, to: -1 });
    return this.states.length - 1;
  }

  eps(from: number, to: number): void {
    this.states[from]!.eps.push(to);
  }

  build(node: Node): Frag {
    switch (node.kind) {
      case "set": {
        const s = this.add();
        const e = this.add();
        this.states[s]!.mask = node.mask;
        this.states[s]!.to = e;
        return { start: s, end: e };
      }
      case "seq": {
        const frags = node.items.map((n) => this.build(n));
        for (let i = 0; i + 1 < frags.length; i++) this.eps(frags[i]!.end, frags[i + 1]!.start);
        return { start: frags[0]!.start, end: frags[frags.length - 1]!.end };
      }
      case "alt": {
        const s = this.add();
        const e = this.add();
        for (const option of node.options) {
          const f = this.build(option);
          this.eps(s, f.start);
          this.eps(f.end, e);
        }
        return { start: s, end: e };
      }
      case "rep":
        return this.repeat(node.item, node.min, node.max);
    }
  }

  private repeat(item: Node, min: number, max: number): Frag {
    const s = this.add();
    let cursor = s;
    for (let i = 0; i < min; i++) {
      const f = this.build(item);
      this.eps(cursor, f.start);
      cursor = f.end;
    }
    const e = this.add();
    if (max === Infinity) {
      const loop = this.add();
      this.eps(cursor, loop);
      const f = this.build(item);
      this.eps(loop, f.start);
      this.eps(f.end, loop);
      this.eps(loop, e);
      return { start: s, end: e };
    }
    for (let i = min; i < max; i++) {
      this.eps(cursor, e);
      const f = this.build(item);
      this.eps(cursor, f.start);
      cursor = f.end;
    }
    this.eps(cursor, e);
    return { start: s, end: e };
  }
}

export function compile(node: Node): Nfa {
  const b = new Builder();
  const f = b.build(node);
  return { states: b.states, start: f.start, accept: f.end };
}

function closure(nfa: Nfa, seeds: number[]): Uint8Array {
  const seen = new Uint8Array(nfa.states.length);
  const stack = [...seeds];
  for (const s of seeds) seen[s] = 1;
  while (stack.length) {
    const s = stack.pop()!;
    for (const t of nfa.states[s]!.eps) {
      if (!seen[t]) {
        seen[t] = 1;
        stack.push(t);
      }
    }
  }
  return seen;
}

function reverseEps(nfa: Nfa): number[][] {
  const rev: number[][] = nfa.states.map(() => []);
  nfa.states.forEach((st, i) => {
    for (const t of st.eps) rev[t]!.push(i);
  });
  return rev;
}

function reverseClosure(rev: number[][], n: number, seeds: number[]): Uint8Array {
  const seen = new Uint8Array(n);
  const stack = [...seeds];
  for (const s of seeds) seen[s] = 1;
  while (stack.length) {
    const s = stack.pop()!;
    for (const t of rev[s]!) {
      if (!seen[t]) {
        seen[t] = 1;
        stack.push(t);
      }
    }
  }
  return seen;
}

// Narrows each position's letter set to letters that sit on some accepting
// path through the whole line. Returns null when no path exists.
export function support(nfa: Nfa, domains: readonly number[]): number[] | null {
  const n = domains.length;
  const { states } = nfa;
  const forward: Uint8Array[] = [closure(nfa, [nfa.start])];
  for (let i = 0; i < n; i++) {
    const next: number[] = [];
    const cur = forward[i]!;
    for (let s = 0; s < states.length; s++) {
      if (cur[s] && states[s]!.mask & domains[i]!) next.push(states[s]!.to);
    }
    forward.push(closure(nfa, next));
  }
  if (!forward[n]![nfa.accept]) return null;

  const rev = reverseEps(nfa);
  const backward: Uint8Array[] = new Array(n + 1);
  backward[n] = reverseClosure(rev, states.length, [nfa.accept]);
  for (let i = n - 1; i >= 0; i--) {
    const prev: number[] = [];
    const after = backward[i + 1]!;
    for (let s = 0; s < states.length; s++) {
      const st = states[s]!;
      if (st.mask & domains[i]! && after[st.to]) prev.push(s);
    }
    backward[i] = reverseClosure(rev, states.length, prev);
  }

  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let m = 0;
    const cur = forward[i]!;
    const after = backward[i + 1]!;
    for (let s = 0; s < states.length; s++) {
      const st = states[s]!;
      if (cur[s] && after[st.to]) m |= st.mask & domains[i]!;
    }
    if (m === 0) return null;
    out.push(m);
  }
  return out;
}

export function matches(nfa: Nfa, text: string): boolean {
  const domains: number[] = [];
  for (const ch of text) domains.push(1 << (ch.charCodeAt(0) - 65));
  return support(nfa, domains) !== null;
}

// Number of distinct strings of the given length the automaton accepts.
export function countStrings(nfa: Nfa, length: number): number {
  const key = (seen: Uint8Array) => seen.join("");
  let layer = new Map<string, { seen: Uint8Array; count: number }>();
  const first = closure(nfa, [nfa.start]);
  layer.set(key(first), { seen: first, count: 1 });
  for (let i = 0; i < length; i++) {
    const next = new Map<string, { seen: Uint8Array; count: number }>();
    for (const { seen, count } of layer.values()) {
      for (let c = 0; c < 26; c++) {
        const seeds: number[] = [];
        for (let s = 0; s < nfa.states.length; s++) {
          if (seen[s] && nfa.states[s]!.mask & (1 << c)) seeds.push(nfa.states[s]!.to);
        }
        if (seeds.length === 0) continue;
        const cl = closure(nfa, seeds);
        const k = key(cl);
        const entry = next.get(k);
        if (entry) entry.count += count;
        else next.set(k, { seen: cl, count });
      }
    }
    layer = next;
  }
  let total = 0;
  for (const { seen, count } of layer.values()) if (seen[nfa.accept]) total += count;
  return total;
}
