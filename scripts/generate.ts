import { generatePuzzle } from "../generator/generate.ts";

const secret = process.env.PUZZLE_SEED ?? "dev";
const from = Number(process.argv[2] ?? 1);
const to = Number(process.argv[3] ?? from);

for (let n = from; n <= to; n++) {
  const started = performance.now();
  const p = generatePuzzle(secret, n);
  const ms = Math.round(performance.now() - started);
  console.log(`# ${n} (${ms}ms)`);
  for (let r = 0; r < 5; r++) console.log(`  ${p.answer[r]}   ${p.rows[r]}`);
  console.log(`  cols: ${p.cols.join("  ")}`);
  console.log();
}
