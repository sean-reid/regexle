# regexle

A daily regex crossword. Five row clues, five column clues, one 5x5 grid of letters that satisfies all ten. You get six tries, and each try colours every cell: right letter in the right place, right letter somewhere else in that row or column, or wrong.

## Development

```sh
npm install
npm run build      # bundle the client into dist/
npm run dev        # wrangler dev on http://localhost:8787
npm test           # unit tests
npm run test:e2e   # Playwright, starts its own server
npm run generate 1 5   # print puzzles 1 to 5 for the seed in PUZZLE_SEED
```

Puzzles come from a seeded generator. It draws a random grid, writes a tight regex for each row and column, proves the grid is the only solution with a small constraint solver, then loosens one clue at a time for as long as the answer stays unique. Every clue is plain JavaScript regex syntax over the letters A to Z, anchored to its whole line.
