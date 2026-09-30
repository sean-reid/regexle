# regexle

A daily regex crossword at [regexle.dwainosaur.com](https://regexle.dwainosaur.com). Five row clues, five column clues, one 5x5 grid of letters that satisfies all ten. The clues narrow the grid but never settle it: a few cells stay open, and the colours after each of your six checks close them. Green is the right letter in the right cell, amber means the answer has that letter elsewhere in the same row or column, grey means it does not.

## Development

```sh
npm install
npm run build          # bundle the client into dist/
npm run dev            # wrangler dev on http://localhost:8787
npm test               # unit tests
npm run test:e2e       # Playwright, seeds local KV then starts wrangler dev
npm run generate 1 5   # print puzzles 1 to 5 for the seed in PUZZLE_SEED
```

## How it runs

One Cloudflare Worker serves the page and three endpoints: today's clues, a guess check, and the day's result histogram. Puzzles live in a KV namespace and the answer never reaches the browser. Each guess is graded on the Worker, which hands back a signed session token carrying the attempt count, so a finished game records its result exactly once in a Durable Object per puzzle day. The puzzle rolls over at local midnight: the client sends its local date and the Worker maps it to a puzzle number from `EPOCH` in `shared/day.ts`.

`scripts/topup.ts` fills the namespace with every missing puzzle up to 400 days ahead, generating from the `PUZZLE_SEED` secret. CI runs it after each deploy and every Monday. It only ever adds keys, so a generator change never alters a puzzle already written.

## Puzzles

The generator is seeded, so a puzzle number always yields the same puzzle for a given seed. It draws a random grid, writes a tight regex for each row and column, then loosens clues one at a time, preferring sets that give away least on their own. Difficulty is measured by playing: a simulated strong player fills a grid consistent with the clues and every colour seen so far, checks it, and repeats. A clue set is kept while that player needs at most three checks, and a finished puzzle must need at least three, so the clues alone never settle the grid and the colours always matter. Clues use plain JavaScript regex syntax over the letters A to Z, anchored to the whole line, and stay under 14 characters.
