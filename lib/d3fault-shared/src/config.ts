/** Deployed program ID on Solana devnet */
export const PLACEHOLDER_PROGRAM_ID = "2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG";

/** Native SOL mint address (wrapped SOL) */
export const SOL_MINT = "So11111111111111111111111111111111111111112";

/** Zero-pubkey used as token_mint sentinel for native SOL entries */
export const SOL_SENTINEL_MINT = "11111111111111111111111111111111";

/** Maximum commitment entries per CommitmentStore (64 = power-of-2, fits Solana 10KB CPI limit) */
export const MAX_ENTRIES = 64;

/** Default devnet RPC endpoint */
export const DEVNET_RPC = "https://api.devnet.solana.com";

/** Commitment store PDA seed */
export const COMMITMENT_STORE_SEED = "commitment_store";

/** Nullifier PDA seed prefix */
export const NULLIFIER_SEED = "nullifier";

/** Default claim link expiry: 72 hours in seconds */
export const DEFAULT_EXPIRY_SECONDS = 72 * 60 * 60;
