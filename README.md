# regexle

A daily regex crossword. Five row clues, five column clues, one 5x5 grid of letters that satisfies all ten. You get six tries, and each try colours every cell: right letter in the right place, right letter somewhere else in that row or column, or wrong.

## Development

```sh
npm install
npm run build      # bundle the client into dist/
npm run dev        # wrangler dev on http://localhost:8787
npm test           # unit tests
npm run test:e2e   # Playwright, starts its own server
```
