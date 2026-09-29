import { MAX_ATTEMPTS } from "../shared/api.ts";

export interface Session {
  number: number;
  attempt: number;
  done: boolean;
  nonce: string;
}

const enc = new TextEncoder();

const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

function fromB64url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  try {
    return Uint8Array.from(atob(padded), (ch) => ch.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

const payload = (s: Session): string => `${s.number}.${s.attempt}.${s.done ? 1 : 0}.${s.nonce}`;

export const newNonce = (): string => b64url(crypto.getRandomValues(new Uint8Array(12)));

export async function issue(secret: string, session: Session): Promise<string> {
  const body = payload(session);
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verify(secret: string, token: unknown): Promise<Session | null> {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [num, att, done, nonce, sig] = parts as [string, string, string, string, string];
  if (
    !/^\d{1,6}$/.test(num) ||
    !/^\d$/.test(att) ||
    !/^[01]$/.test(done) ||
    !/^[A-Za-z0-9_-]{16}$/.test(nonce)
  ) {
    return null;
  }
  const sigBytes = fromB64url(sig);
  if (!sigBytes) return null;
  const body = `${num}.${att}.${done}.${nonce}`;
  const ok = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    sigBytes as BufferSource,
    enc.encode(body),
  );
  if (!ok) return null;
  const attempt = Number(att);
  if (attempt > MAX_ATTEMPTS) return null;
  return { number: Number(num), attempt, done: done === "1", nonce };
}
