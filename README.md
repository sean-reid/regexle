# regexle

A daily regex crossword. Five row clues, five column clues, one 5x5 grid of letters that satisfies all ten. You get six tries, and each try colours every cell: right letter in the right place, right letter somewhere else in that row or column, or wrong.

## Development

```sh
npm install
npm run build      # bundle the client into dist/
npm run dev        # wrangler dev on http://localhost:8787
npm test           # unit tests
npm run test:e2e   # Playwright, seeds local KV then starts wrangler dev
npm run generate 1 5   # print puzzles 1 to 5 for the seed in PUZZLE_SEED
```

## How it runs

One Cloudflare Worker serves the page and three endpoints: today's clues, a guess check, and the day's result histogram. Puzzles live in a KV namespace and the answer never reaches the browser. Each guess is graded on the Worker, which hands back a signed session token carrying the attempt count, so a finished game records its result exactly once in a Durable Object per puzzle day. The puzzle rolls over at local midnight: the client sends its local date and the Worker maps it to a puzzle number from `EPOCH` in `shared/day.ts`.

`scripts/topup.ts` fills the namespace with every missing puzzle up to 400 days ahead, generating from the `PUZZLE_SEED` secret. CI runs it after each deploy and every Monday. It only ever adds keys, so a generator change never alters a puzzle already written.

Puzzles come from a seeded generator. It draws a random grid, writes a tight regex for each row and column, proves the grid is the only solution with a small constraint solver, then loosens one clue at a time for as long as the answer stays unique. Every clue is plain JavaScript regex syntax over the letters A to Z, anchored to its whole line.
