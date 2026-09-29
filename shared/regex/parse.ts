import { FULL, type Node, bit, set } from "./ast.ts";

export class RegexSyntaxError extends Error {
  readonly index: number;

  constructor(message: string, index: number) {
    super(`${message} at ${index}`);
    this.index = index;
  }
}

class Parser {
  private i = 0;
  private readonly src: string;

  constructor(src: string) {
    this.src = src;
  }

  parse(): Node {
    const node = this.alt();
    if (this.i < this.src.length) throw new RegexSyntaxError("unexpected character", this.i);
    return node;
  }

  private peek(): string {
    return this.src[this.i] ?? "";
  }

  private alt(): Node {
    const options = [this.seq()];
    while (this.peek() === "|") {
      this.i++;
      options.push(this.seq());
    }
    return options.length === 1 ? options[0]! : { kind: "alt", options };
  }

  private seq(): Node {
    const items: Node[] = [];
    while (this.i < this.src.length && this.peek() !== "|" && this.peek() !== ")") {
      items.push(this.rep());
    }
    if (items.length === 0) throw new RegexSyntaxError("empty branch", this.i);
    return items.length === 1 ? items[0]! : { kind: "seq", items };
  }

  private rep(): Node {
    const item = this.atom();
    const ch = this.peek();
    if (ch === "?") return this.take({ kind: "rep", item, min: 0, max: 1 });
    if (ch === "*") return this.take({ kind: "rep", item, min: 0, max: Infinity });
    if (ch === "+") return this.take({ kind: "rep", item, min: 1, max: Infinity });
    if (ch === "{") return this.braces(item);
    return item;
  }

  private take(node: Node): Node {
    this.i++;
    return node;
  }

  private braces(item: Node): Node {
    const start = this.i;
    const m = /^\{(\d+)(,(\d*))?\}/.exec(this.src.slice(this.i));
    if (!m) throw new RegexSyntaxError("bad quantifier", start);
    const min = Number(m[1]);
    const max = m[2] === undefined ? min : m[3] === "" ? Infinity : Number(m[3]);
    if (max < min) throw new RegexSyntaxError("quantifier out of order", start);
    this.i += m[0].length;
    return { kind: "rep", item, min, max };
  }

  private atom(): Node {
    const ch = this.peek();
    const at = this.i;
    if (ch === "(") {
      this.i++;
      const inner = this.alt();
      if (this.peek() !== ")") throw new RegexSyntaxError("unclosed group", at);
      this.i++;
      return inner;
    }
    if (ch === "[") return this.charClass();
    if (ch === ".") {
      this.i++;
      return set(FULL);
    }
    if (/^[A-Z]$/.test(ch)) {
      this.i++;
      return set(bit(ch));
    }
    throw new RegexSyntaxError(ch === "" ? "unexpected end" : "unexpected character", at);
  }

  private charClass(): Node {
    const at = this.i;
    this.i++;
    let negated = false;
    if (this.peek() === "^") {
      negated = true;
      this.i++;
    }
    let mask = 0;
    while (this.peek() !== "]") {
      const ch = this.peek();
      if (!/^[A-Z]$/.test(ch)) throw new RegexSyntaxError("bad character class", at);
      this.i++;
      if (this.peek() === "-" && /^[A-Z]$/.test(this.src[this.i + 1] ?? "")) {
        const hi = this.src[this.i + 1]!;
        if (hi < ch) throw new RegexSyntaxError("range out of order", at);
        for (let c = ch.charCodeAt(0); c <= hi.charCodeAt(0); c++) mask |= 1 << (c - 65);
        this.i += 2;
      } else {
        mask |= bit(ch);
      }
    }
    this.i++;
    if (mask === 0) throw new RegexSyntaxError("empty character class", at);
    return set(negated ? FULL & ~mask : mask, negated);
  }
}

export function parse(src: string): Node {
  return new Parser(src).parse();
}
