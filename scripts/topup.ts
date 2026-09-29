import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePuzzle } from "../generator/generate.ts";
import { puzzleNumber } from "../shared/day.ts";
import { PUZZLE_PREFIX, puzzleKey } from "../shared/store.ts";

// Writes every missing puzzle up to DAYS_AHEAD days past today into the
// PUZZLES namespace. Existing keys are never touched, so a change to the
// generator only affects puzzles nobody has seen yet.
const DAYS_AHEAD = 400;

const args = new Set(process.argv.slice(2));
const local = args.has("--local");
const daysArg = process.argv[process.argv.indexOf("--days") + 1];
const days = process.argv.includes("--days") ? Number(daysArg) : DAYS_AHEAD;
const secret = process.env.PUZZLE_SEED ?? (local ? "dev" : "");
if (!secret) {
  console.error("PUZZLE_SEED is required for a remote top-up");
  process.exit(1);
}

const where = local ? "--local" : "--remote";
const wrangler = (...cmd: string[]): string =>
  execFileSync("npx", ["wrangler", ...cmd], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

const listed = JSON.parse(
  wrangler("kv", "key", "list", "--binding", "PUZZLES", "--prefix", PUZZLE_PREFIX, where),
) as { name: string }[];
const have = listed.map((k) => Number(k.name.slice(PUZZLE_PREFIX.length))).filter(Number.isInteger);
const latest = have.length ? Math.max(...have) : 0;

const today = puzzleNumber(new Date().toISOString().slice(0, 10)) ?? 1;
const target = today + days;
if (latest >= target) {
  console.log(`ok: ${latest - today} days ahead, nothing to write`);
  process.exit(0);
}

const started = performance.now();
const entries = [];
for (let n = Math.max(1, latest + 1); n <= target; n++) {
  entries.push({ key: puzzleKey(n), value: JSON.stringify(generatePuzzle(secret, n)) });
}
const file = join(mkdtempSync(join(tmpdir(), "regexle-")), "puzzles.json");
writeFileSync(file, JSON.stringify(entries));
wrangler("kv", "bulk", "put", file, "--binding", "PUZZLES", where);
const seconds = ((performance.now() - started) / 1000).toFixed(1);
console.log(
  `wrote puzzles ${entries[0]!.key} to ${entries[entries.length - 1]!.key} in ${seconds}s`,
);
