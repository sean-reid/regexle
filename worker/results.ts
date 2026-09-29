import { DurableObject } from "cloudflare:workers";
import { MAX_ATTEMPTS, type Histogram } from "../shared/api.ts";

const COUNTS = "counts";
const SEEN = "seen:";
const PURGE_AFTER_MS = 3 * 86_400_000;

// One object per puzzle day. Index 0 counts failed games, 1 to 6 count
// wins by attempts used. Each finished game records once, keyed by its
// session nonce, and the nonces are purged a few days after the day ends.
export class PuzzleResults extends DurableObject {
  async histogram(): Promise<Histogram> {
    const counts =
      (await this.ctx.storage.get<number[]>(COUNTS)) ?? new Array<number>(MAX_ATTEMPTS + 1).fill(0);
    return { counts, total: counts.reduce((a, b) => a + b, 0) };
  }

  async record(nonce: string, guesses: number): Promise<Histogram> {
    if (await this.ctx.storage.get(`${SEEN}${nonce}`)) return this.histogram();
    const { counts } = await this.histogram();
    counts[guesses] = (counts[guesses] ?? 0) + 1;
    await this.ctx.storage.put({ [COUNTS]: counts, [`${SEEN}${nonce}`]: 1 });
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + PURGE_AFTER_MS);
    }
    return { counts, total: counts.reduce((a, b) => a + b, 0) };
  }

  async alarm(): Promise<void> {
    const seen = await this.ctx.storage.list({ prefix: SEEN });
    await this.ctx.storage.delete([...seen.keys()]);
  }
}
