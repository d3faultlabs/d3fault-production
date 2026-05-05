import { Connection } from "@solana/web3.js";

const NETWORK = (process.env["SOLANA_NETWORK"] ?? "devnet") as string;
const PRIMARY =
  process.env["SOLANA_RPC_ENDPOINT"] ??
  (NETWORK === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");
// Optional secondary Helius (or any) endpoint — used as the first fallback
// before the public RPCs so we stay on a paid, fast endpoint as long as
// possible. Set SOLANA_RPC_ENDPOINT_2 to enable.
const SECONDARY = process.env["SOLANA_RPC_ENDPOINT_2"];

const MAINNET_FALLBACKS = [
  PRIMARY,
  ...(SECONDARY ? [SECONDARY] : []),
  "https://api.mainnet-beta.solana.com",
  "https://rpc.ankr.com/solana",
  "https://solana-mainnet.rpc.extrnode.com",
];

const DEVNET_FALLBACKS = [PRIMARY];

export const RPC_LIST: string[] =
  NETWORK === "mainnet-beta"
    ? [...new Set(MAINNET_FALLBACKS)]
    : DEVNET_FALLBACKS;

export function isTransientError(err: unknown): boolean {
  const msg = String(err).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("service unavailable") ||
    msg.includes("econnrefused") ||
    msg.includes("fetch failed") ||
    msg.includes("network error") ||
    msg.includes("etimedout") ||
    msg.includes("socket hang up")
  );
}

/**
 * Runs `fn` with each RPC in RPC_LIST in order, moving to the next one only
 * on transient errors (rate limits, connectivity). Throws on the first
 * non-transient error or once all RPCs are exhausted.
 */
export async function withRpcFallback<T>(
  fn: (conn: Connection) => Promise<T>
): Promise<T> {
  let lastErr: unknown;
  for (const rpc of RPC_LIST) {
    try {
      return await fn(new Connection(rpc, "confirmed"));
    } catch (e) {
      lastErr = e;
      if (!isTransientError(e)) throw e;
    }
  }
  throw lastErr;
}
