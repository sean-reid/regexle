export const MAX_ATTEMPTS = 6;

export type Mark = "g" | "y" | "x";

export interface PuzzleResponse {
  number: number;
  date: string;
  rows: string[];
  cols: string[];
}

export interface GuessRequest {
  number: number;
  grid: string[];
  token?: string;
}

export interface Histogram {
  counts: number[];
  total: number;
}

export interface GuessResponse {
  marks: string[];
  correct: boolean;
  attempt: number;
  done: boolean;
  token: string;
  answer?: string[];
  stats?: Histogram;
}

export interface StatsResponse extends Histogram {
  number: number;
}
