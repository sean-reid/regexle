import type { GuessResponse, PuzzleResponse, StatsResponse } from "../shared/api";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* body was not json */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export const fetchPuzzle = (date: string): Promise<PuzzleResponse> =>
  call(`/api/puzzle?date=${date}`);

export const postGuess = (number: number, grid: string[], token?: string): Promise<GuessResponse> =>
  call("/api/guess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(token ? { number, grid, token } : { number, grid }),
  });

export const fetchStats = (number: number): Promise<StatsResponse> => call(`/api/stats/${number}`);
