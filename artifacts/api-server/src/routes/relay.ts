import { Router } from "express";
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { withRpcFallback } from "../lib/rpc.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createHash } from "node:crypto";
import rateLimit from "express-rate-limit";
import { RelayWithdrawBody } from "@workspace/api-zod";
import { IDL } from "@workspace/d3fault-shared";

const router = Router();

const NETWORK = (process.env["SOLANA_NETWORK"] ?? "devnet") as
  | "devnet"
  | "mainnet-beta";
const RPC_ENDPOINT =
  process.env["SOLANA_RPC_ENDPOINT"] ?? "https://api.devnet.solana.com";

export const PROGRAM_ID =
  process.env["PROGRAM_ID"] ?? "11111111111111111111111111111111";
export const NETWORK_NAME = NETWORK;
export const RPC = RPC_ENDPOINT;

// ─── Types matching the on-chain CommitmentStore layout ────────────────────

interface CommitmentEntry {
  commitment: number[];
  amount: bigint;
  expiry: bigint;
  tokenMint: number[];
  /** 0 = unclaimed, 1 = claimed (u8 in zero_copy layout) */
  claimed: number;
  pad: number[];
  /** Raw [u8;32] bytes — NOT a PublicKey in zero_copy layout */
  depositor: number[];
}

interface CommitmentStoreAccount {
  count: bigint;
  head: bigint;
  entries: CommitmentEntry[];
}

// Typed wrapper around the Anchor Program for our two withdraw instructions
interface PrivateTransferMethods {
  withdrawSol: (secret: number[]) => {
    accounts: (a: {
      commitmentStore: PublicKey;
      nullifierRecord: PublicKey;
      recipient: PublicKey;
      relayer: PublicKey;
      systemProgram: PublicKey;
    }) => { rpc: () => Promise<string> };
  };
  withdrawSpl: (secret: number[]) => {
    accounts: (a: {
      commitmentStore: PublicKey;
      nullifierRecord: PublicKey;
      recipient: PublicKey;
      tokenMint: PublicKey;
      escrowTokenAccount: PublicKey;
      recipientTokenAccount: PublicKey;
      relayer: PublicKey;
      tokenProgram: PublicKey;
      associatedTokenProgram: PublicKey;
      systemProgram: PublicKey;
    }) => { rpc: () => Promise<string> };
  };
}

interface PrivateTransferAccountNamespace {
  commitmentStore: {
    fetch: (key: PublicKey) => Promise<CommitmentStoreAccount>;
  };
}

// ─── Raw CommitmentStore parser ────────────────────────────────────────────
//
// The on-chain account uses a zero_copy fixed array [CommitmentEntry; 64].
// The IDL describes it as `vec<CommitmentEntry>` which causes Anchor's Borsh
// decoder to read the first 4 bytes as a length → buffer overflow.
// We parse the raw account bytes directly instead.
//
// Layout (after 8-byte discriminator):
//   count   : u64   (8 bytes)
//   head    : u64   (8 bytes)
//   entries : [CommitmentEntry; 64]  (64 × 120 bytes = 7680 bytes)
//
// CommitmentEntry (120 bytes):
//   commitment : [u8; 32]  (32)
//   amount     : u64       (8)
//   expiry     : i64       (8)
//   tokenMint  : [u8; 32]  (32)
//   claimed    : u8        (1)
//   _pad       : [u8; 7]   (7)  — alignment padding
//   depositor  : [u8; 32]  (32)

const ENTRY_SIZE = 120;
const NUM_SLOTS  = 64;

function parseCommitmentStoreRaw(data: Buffer): CommitmentStoreAccount {
  let off = 8; // skip 8-byte discriminator
  const count = data.readBigUInt64LE(off); off += 8;
  const head  = data.readBigUInt64LE(off); off += 8;

  const entries: CommitmentEntry[] = [];
  for (let i = 0; i < NUM_SLOTS; i++) {
    const base = off + i * ENTRY_SIZE;
    const commitment = Array.from(data.slice(base, base + 32));
    const amount     = data.readBigUInt64LE(base + 32);
    const expiry     = data.readBigInt64LE(base + 40);
    const tokenMint  = Array.from(data.slice(base + 48, base + 80));
    const claimed    = data.readUInt8(base + 80);
    // base + 81 .. base + 87 = 7 bytes alignment padding (skip)
    const depositor  = Array.from(data.slice(base + 88, base + 120));
    entries.push({ commitment, amount, expiry, tokenMint, claimed, pad: [], depositor });
  }

  return { count, head, entries };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getRelayerKeypair(): Keypair {
  const rawKey = process.env["RELAYER_PRIVATE_KEY"];
  if (!rawKey) throw new Error("RELAYER_PRIVATE_KEY is not set");
  const parsed = JSON.parse(rawKey) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(parsed));
}

function makeWallet(kp: Keypair) {
  return {
    publicKey: kp.publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(
      tx: T
    ): Promise<T> => {
      if (tx instanceof Transaction) {
        tx.partialSign(kp);
      } else {
        tx.sign([kp]);
      }
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      txs: T[]
    ): Promise<T[]> =>
      txs.map((tx) => {
        if (tx instanceof Transaction) {
          tx.partialSign(kp);
        } else {
          tx.sign([kp]);
        }
        return tx;
      }),
  };
}

/** sha256(hex-decoded secret) → 32-byte Buffer */
function computeCommitment(secretHex: string): Buffer {
  return createHash("sha256")
    .update(Buffer.from(secretHex, "hex"))
    .digest();
}

// ─── Rate limiter ──────────────────────────────────────────────────────────

const relayLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many relay requests, please try again later",
    code: "RATE_LIMITED",
  },
});

// ─── POST /relay-withdraw ──────────────────────────────────────────────────

router.post("/relay-withdraw", relayLimiter, async (req, res) => {
  const log = req.log;

  const parsed = RelayWithdrawBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", code: "INVALID_REQUEST" });
    return;
  }

  const { secret, recipient } = parsed.data;

  if (PROGRAM_ID === "11111111111111111111111111111111") {
    log.warn("Relay withdraw attempted but program is not deployed yet");
    res.status(503).json({
      error:
        "Program not yet deployed. Set the PROGRAM_ID environment variable to the deployed program address.",
      code: "PROGRAM_NOT_DEPLOYED",
    });
    return;
  }

  if (!/^[0-9a-f]{64}$/i.test(secret)) {
    res.status(400).json({
      error: "secret must be a 64-character hex string (32 bytes)",
      code: "INVALID_SECRET_FORMAT",
    });
    return;
  }

  let relayerKeypair: Keypair;
  try {
    relayerKeypair = getRelayerKeypair();
  } catch (err) {
    log.error({ err }, "Failed to load relayer keypair");
    res.status(500).json({ error: "Relayer not configured", code: "RELAYER_NOT_CONFIGURED" });
    return;
  }

  let recipientPubkey: PublicKey;
  try {
    recipientPubkey = new PublicKey(recipient);
  } catch {
    res.status(400).json({ error: "Invalid recipient address", code: "INVALID_RECIPIENT" });
    return;
  }

  log.info({ recipient }, "Relay withdraw request");

  try {
    const programId = new PublicKey(PROGRAM_ID);
    const secretBytes = Buffer.from(secret, "hex");
    const secretArr = Array.from(secretBytes);
    const commitmentBytes = computeCommitment(secret);

    const [commitmentStorePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("commitment_store")],
      programId
    );
    const [nullifierPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nullifier"), commitmentBytes],
      programId
    );

    // ── Phase 1: Read commitment store via raw account bytes ──────────────────
    // We bypass Anchor's IDL Borsh decoder because the IDL declares entries as
    // `vec<CommitmentEntry>` while on-chain it is a fixed [CommitmentEntry; 64]
    // array. Using the IDL decoder causes a buffer-overflow RangeError.
    const store = await withRpcFallback(async (conn) => {
      const info = await conn.getAccountInfo(commitmentStorePda, "confirmed");
      if (!info) throw new Error("Commitment store account not found");
      return parseCommitmentStoreRaw(Buffer.from(info.data));
    });

    const entry = store.entries.find(
      (e) =>
        e.claimed === 0 &&
        Buffer.from(e.commitment).equals(commitmentBytes)
    );

    if (!entry) {
      res.status(404).json({
        error: "No matching unclaimed commitment found",
        code: "COMMITMENT_NOT_FOUND",
      });
      return;
    }

    // Check expiry on server side before submitting tx
    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    if (nowSec > entry.expiry) {
      res.status(410).json({ error: "Claim link has expired", code: "EXPIRED" });
      return;
    }

    const SOL_SENTINEL = Buffer.alloc(32, 0);
    const isSol = Buffer.from(entry.tokenMint).equals(SOL_SENTINEL);

    // ── Phase 2: Submit transaction (RPC fallback — safe because tx not yet sent) ──
    let signature: string;

    if (isSol) {
      signature = await withRpcFallback(async (conn) => {
        const provider = new AnchorProvider(conn, makeWallet(relayerKeypair), { commitment: "confirmed" });
        const idlWithAddress = { ...IDL, address: PROGRAM_ID, events: [] } as unknown as Idl;
        const program = new Program(idlWithAddress, provider);
        const methods = program.methods as unknown as PrivateTransferMethods;
        return methods
          .withdrawSol(secretArr)
          .accounts({
            commitmentStore: commitmentStorePda,
            nullifierRecord: nullifierPda,
            recipient: recipientPubkey,
            relayer: relayerKeypair.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      });
    } else {
      const tokenMintPubkey = new PublicKey(Buffer.from(entry.tokenMint));

      const escrowTokenAccount = getAssociatedTokenAddressSync(
        tokenMintPubkey,
        commitmentStorePda,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const recipientTokenAccount = getAssociatedTokenAddressSync(
        tokenMintPubkey,
        recipientPubkey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      signature = await withRpcFallback(async (conn) => {
        const provider = new AnchorProvider(conn, makeWallet(relayerKeypair), { commitment: "confirmed" });
        const idlWithAddress = { ...IDL, address: PROGRAM_ID, events: [] } as unknown as Idl;
        const program = new Program(idlWithAddress, provider);
        const methods = program.methods as unknown as PrivateTransferMethods;
        return methods
          .withdrawSpl(secretArr)
          .accounts({
            commitmentStore: commitmentStorePda,
            nullifierRecord: nullifierPda,
            recipient: recipientPubkey,
            tokenMint: tokenMintPubkey,
            escrowTokenAccount,
            recipientTokenAccount,
            relayer: relayerKeypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      });
    }

    const explorerUrl = NETWORK === "mainnet-beta"
      ? `https://solscan.io/tx/${signature}`
      : `https://solscan.io/tx/${signature}?cluster=${NETWORK}`;
    log.info({ signature }, "Relay withdraw succeeded");
    res.json({ signature, explorerUrl });
  } catch (err) {
    log.error({ err }, "Relay withdraw failed");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message, code: "TX_FAILED" });
  }
});

// ─── GET /price ────────────────────────────────────────────────────────────

router.get("/price", async (req, res) => {
  const log = req.log;
  const mint = req.query["mint"] as string | undefined;

  if (!mint) {
    res.status(400).json({ error: "mint query param required", code: "MISSING_PARAM" });
    return;
  }

  const SOL_MINT = "So11111111111111111111111111111111111111112";
  const SOL_SENTINEL_MINT = "11111111111111111111111111111111";

  try {
    if (mint === SOL_MINT || mint === SOL_SENTINEL_MINT) {
      const cgRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true"
      );
      if (!cgRes.ok) throw new Error("CoinGecko request failed");
      const cgData = (await cgRes.json()) as {
        solana: { usd: number; usd_24h_change: number };
      };
      res.json({
        mint,
        symbol: "SOL",
        usdPrice: cgData.solana.usd,
        change24h: cgData.solana.usd_24h_change,
      });
      return;
    }

    const dexRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`
    );
    if (!dexRes.ok) throw new Error("DexScreener request failed");
    const dexData = (await dexRes.json()) as {
      pairs?: Array<{
        baseToken: { symbol: string };
        priceUsd: string;
        priceChange: { h24: number };
      }>;
    };

    if (!dexData.pairs || dexData.pairs.length === 0) {
      res.status(404).json({ error: "Token not found", code: "NOT_FOUND" });
      return;
    }

    const pair = dexData.pairs[0]!;
    res.json({
      mint,
      symbol: pair.baseToken.symbol,
      usdPrice: parseFloat(pair.priceUsd),
      change24h: pair.priceChange.h24,
    });
  } catch (err) {
    log.error({ err, mint }, "Price lookup failed");
    res.status(500).json({ error: "Price lookup failed", code: "PRICE_ERROR" });
  }
});

export default router;
