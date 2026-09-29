import { describe, expect, it } from "vitest";
import { FULL, lettersOf, maskOf, render } from "../../shared/regex/ast.ts";
import { compile, countStrings, matches, support } from "../../shared/regex/nfa.ts";
import { RegexSyntaxError, parse } from "../../shared/regex/parse.ts";
import { seeded, int, pick } from "../../generator/rng.ts";

const js = (src: string) => new RegExp(`^(?:${src})$`);

describe("parse and render", () => {
  it.each([
    ["A", "A"],
    [".", "."],
    ["[ABC]", "[A-C]"],
    ["[ACE]", "[ACE]"],
    ["[A-CK]", "[A-CK]"],
    ["[^QZ]", "[^QZ]"],
    ["A?", "A?"],
    ["A*", "A*"],
    ["A+", "A+"],
    ["A{3}", "A{3}"],
    ["A{2,}", "A{2,}"],
    ["A{2,4}", "A{2,4}"],
    ["(AB|CD)", "(AB|CD)"],
    ["(AB|CD)+", "(AB|CD)+"],
    ["(AB){2}", "(AB){2}"],
    ["[AEIOU]{2}[^X]+", "[AEIOU]{2}[^X]+"],
  ])("round trips %s as %s", (src, canonical) => {
    expect(render(parse(src))).toBe(canonical);
    expect(render(parse(canonical))).toBe(canonical);
  });

  it("parses a negated class as everything else", () => {
    const node = parse("[^AB]");
    expect(node.kind).toBe("set");
    if (node.kind === "set") expect(lettersOf(node.mask)).toBe("CDEFGHIJKLMNOPQRSTUVWXYZ");
  });

  it.each(["", "(", "A)", "[]", "[Z-A]", "A{3,1}", "a", "A{", "|A", "A||B", "[A-]"])(
    "rejects %j",
    (src) => {
      expect(() => parse(src)).toThrow(RegexSyntaxError);
    },
  );
});

describe("nfa matching", () => {
  it.each([
    ["ABCDE", "ABCDE", true],
    ["A.C.E", "ABCDE", true],
    ["[AEIOU]{2}[^X]+", "AEBCD", true],
    ["[AEIOU]{2}[^X]+", "AEBXD", false],
    ["(AB|BA).*", "BACDE", true],
    ["(AB|BA).*", "ABBAX", true],
    ["(AB|BA).*", "CABBA", false],
    ["A*", "AAAAA", true],
    ["A*", "AAAAB", false],
    ["(A?)*B{5}", "BBBBB", true],
    ["Q?ABCD", "QABCD", true],
    ["Q?ABCDE", "ABCDE", true],
    ["Q?ABCD", "ABCDX", false],
  ])("%s against %s is %s", (src, text, expected) => {
    expect(matches(compile(parse(src)), text)).toBe(expected);
    expect(js(src).test(text)).toBe(expected);
  });

  it("agrees with the platform engine on random regexes and strings", () => {
    const rng = seeded("nfa-vs-js");
    const atoms = ["A", "B", "C", ".", "[AB]", "[^A]", "[B-C]"];
    const quants = ["", "", "", "?", "*", "+", "{2}", "{1,2}", "{2,}"];
    for (let i = 0; i < 500; i++) {
      let src = "";
      const parts = 1 + int(rng, 4);
      for (let k = 0; k < parts; k++) {
        const atom =
          int(rng, 5) === 0
            ? `(${pick(rng, atoms)}${pick(rng, atoms)}|${pick(rng, atoms)})`
            : pick(rng, atoms);
        src += atom + pick(rng, quants);
      }
      const nfa = compile(parse(src));
      const re = js(src);
      for (let t = 0; t < 40; t++) {
        let text = "";
        for (let k = 0; k < 5; k++) text += pick(rng, ["A", "B", "C", "D"]);
        expect(matches(nfa, text), `${src} vs ${text}`).toBe(re.test(text));
      }
    }
  });
});

describe("support", () => {
  const brute = (src: string, domains: number[]): number[] | null => {
    const re = js(src);
    const out = new Array<number>(domains.length).fill(0);
    let any = false;
    const walk = (i: number, prefix: string, used: number[]) => {
      if (i === domains.length) {
        if (re.test(prefix)) {
          any = true;
          used.forEach((b, k) => (out[k]! |= b));
        }
        return;
      }
      for (let c = 0; c < 26; c++) {
        const b = 1 << c;
        if (domains[i]! & b) walk(i + 1, prefix + String.fromCharCode(65 + c), [...used, b]);
      }
    };
    walk(0, "", []);
    return any ? out : null;
  };

  it("narrows each position to letters on an accepting path", () => {
    const got = support(compile(parse("[AB]C[^C]{2}D")), [FULL, FULL, FULL, FULL, FULL]);
    expect(got?.map(lettersOf)).toEqual([
      "AB",
      "C",
      "ABDEFGHIJKLMNOPQRSTUVWXYZ",
      "ABDEFGHIJKLMNOPQRSTUVWXYZ",
      "D",
    ]);
  });

  it("returns null when the domains admit no match", () => {
    expect(
      support(compile(parse("A{5}")), [maskOf("A"), maskOf("B"), FULL, FULL, FULL]),
    ).toBeNull();
  });

  it("matches brute force over small domains", () => {
    const rng = seeded("support-brute");
    const srcs = [
      "[AB]C[^C]{2}D",
      "(AB|BA)+.",
      ".*A.*",
      "[A-C]{2,3}D+",
      "A?B?C?D?E?F?",
      "(A|BC)*D?",
    ];
    for (let i = 0; i < 60; i++) {
      const src = pick(rng, srcs);
      const domains: number[] = [];
      for (let k = 0; k < 5; k++) {
        let m = 0;
        const size = 1 + int(rng, 3);
        while (m === 0 || lettersOf(m).length < size) m |= 1 << int(rng, 6);
        domains.push(m);
      }
      expect(support(compile(parse(src)), domains), `${src} ${domains.map(lettersOf)}`).toEqual(
        brute(src, domains),
      );
    }
  });
});

describe("countStrings", () => {
  it.each([
    ["ABCDE", 1],
    ["ABCD.", 26],
    ["[AB]{5}", 32],
    [".{5}", 26 ** 5],
    [".*A.*", 26 ** 5 - 25 ** 5],
    ["(A|B|AB)C{3,4}", 3],
  ])("%s admits %d strings of length 5", (src, expected) => {
    expect(countStrings(compile(parse(src)), 5)).toBe(expected);
  });
});
