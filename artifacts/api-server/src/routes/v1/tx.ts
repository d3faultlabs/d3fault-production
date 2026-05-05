import { Router } from "express";
import { Buffer } from "node:buffer";
import { z } from "zod";
import { AnchorProvider, Program, type Idl } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { IDL } from "@workspace/d3fault-shared";
import { withRpcFallback } from "../../lib/rpc.js";
import { PROGRAM_ID, NETWORK_NAME } from "../relay.js";
import {
  buildDepositSolTx,
  buildDepositSplTx,
  commitmentFromSecretHex,
} from "../../lib/program-helpers.js";

const router = Router();

const HEX64 = /^[0-9a-f]{64}$/i;

// ───────────────────────── tx/deposit-sol/build ─────────────────────────

const depositSolSchema = z.object({
  depositor: z.string().min(32),
  amount: z.union([z.number(), z.string()]),
  expiry: z.union([z.number(), z.string()]),
  commitment: z.string().regex(HEX64, "commitment must be 64-char hex"),
});

router.post("/tx/deposit-sol/build", async (req, res) => {
  const parsed = depositSolSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Invalid request",
      code: "INVALID_REQUEST",
    });
    return;
  }
  const { depositor, amount, expiry, commitment } = parsed.data;
  if (PROGRAM_ID === "11111111111111111111111111111111") {
    res.status(503).json({
      error: "PROGRAM_NOT_DEPLOYED",
      code: "PROGRAM_NOT_DEPLOYED",
    });
    return;
  }
  let amountLamports: bigint;
  let expirySec: bigint;
  try {
    amountLamports = BigInt(amount);
    expirySec = BigInt(expiry);
    new PublicKey(depositor); // validate
  } catch {
    res
      .status(400)
      .json({ error: "Invalid numeric or pubkey input", code: "INVALID_REQUEST" });
    return;
  }
  if (amountLamports <= 0n) {
    res.status(400).json({ error: "amount must be > 0", code: "INVALID_AMOUNT" });
    return;
  }
  try {
    const { txBase64, feeLamports } = await buildDepositSolTx({
      depositor,
      amountLamports,
      expiry: expirySec,
      commitment: Buffer.from(commitment, "hex"),
    });
    res.json({
      tx: txBase64,
      feeLamports: feeLamports.toString(),
      commitment: commitment.toLowerCase(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to build deposit-sol tx");
    res
      .status(500)
      .json({ error: "Failed to build transaction", code: "BUILD_FAILED" });
  }
});

// ───────────────────────── tx/deposit-spl/build ─────────────────────────

const depositSplSchema = z.object({
  depositor: z.string().min(32),
  mint: z.string().min(32),
  amount: z.union([z.number(), z.string()]),
  decimals: z.number().int().min(0).max(18).optional(),
  expiry: z.union([z.number(), z.string()]),
  commitment: z.string().regex(HEX64),
});

router.post("/tx/deposit-spl/build", async (req, res) => {
  const parsed = depositSplSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Invalid request",
      code: "INVALID_REQUEST",
    });
    return;
  }
  const { depositor, mint, amount, expiry, commitment } = parsed.data;
  if (PROGRAM_ID === "11111111111111111111111111111111") {
    res
      .status(503)
      .json({ error: "PROGRAM_NOT_DEPLOYED", code: "PROGRAM_NOT_DEPLOYED" });
    return;
  }
  let raw: bigint;
  let expirySec: bigint;
  try {
    raw = BigInt(amount);
    expirySec = BigInt(expiry);
    new PublicKey(depositor);
    new PublicKey(mint);
  } catch {
    res
      .status(400)
      .json({ error: "Invalid numeric or pubkey input", code: "INVALID_REQUEST" });
    return;
  }
  if (raw <= 0n) {
    res.status(400).json({ error: "amount must be > 0", code: "INVALID_AMOUNT" });
    return;
  }
  try {
    const { txBase64, feeLamports } = await buildDepositSplTx({
      depositor,
      mint,
      amount: raw,
      expiry: expirySec,
      commitment: Buffer.from(commitment, "hex"),
    });
    res.json({
      tx: txBase64,
      feeLamports: feeLamports.toString(),
      commitment: commitment.toLowerCase(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to build deposit-spl tx");
    res
      .status(500)
      .json({ error: "Failed to build transaction", code: "BUILD_FAILED" });
  }
});

// ───────────────────────── tx/withdraw (relayer-signed) ─────────────────────────

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

const ENTRY_SIZE = 120;
const NUM_SLOTS = 64;
const SOL_SENTINEL_BYTES = Buffer.alloc(32, 0);

interface RawEntry {
  commitment: Buffer;
  amount: bigint;
  expiry: bigint;
  tokenMint: Buffer;
  claimed: number;
}

function parseStoreRaw(data: Buffer): RawEntry[] {
  const entries: RawEntry[] = [];
  let off = 8 + 16;
  for (let i = 0; i < NUM_SLOTS; i++) {
    const base = off + i * ENTRY_SIZE;
    entries.push({
      commitment: Buffer.from(data.slice(base, base + 32)),
      amount: data.readBigUInt64LE(base + 32),
      expiry: data.readBigInt64LE(base + 40),
      tokenMint: Buffer.from(data.slice(base + 48, base + 80)),
      claimed: data.readUInt8(base + 80),
    });
  }
  return entries;
}

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
      tx: T,
    ): Promise<T> => {
      if (tx instanceof Transaction) tx.partialSign(kp);
      else tx.sign([kp]);
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      txs: T[],
    ): Promise<T[]> =>
      txs.map((tx) => {
        if (tx instanceof Transaction) tx.partialSign(kp);
        else tx.sign([kp]);
        return tx;
      }),
  };
}

const withdrawSchema = z.object({
  secret: z.string().regex(HEX64, "secret must be 64-char hex"),
  recipient: z.string().min(32),
});

router.post("/tx/withdraw", async (req, res) => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Invalid request",
      code: "INVALID_REQUEST",
    });
    return;
  }
  const { secret, recipient } = parsed.data;

  if (PROGRAM_ID === "11111111111111111111111111111111") {
    res
      .status(503)
      .json({ error: "PROGRAM_NOT_DEPLOYED", code: "PROGRAM_NOT_DEPLOYED" });
    return;
  }

  let recipientPk: PublicKey;
  try {
    recipientPk = new PublicKey(recipient);
  } catch {
    res
      .status(400)
      .json({ error: "Invalid recipient pubkey", code: "INVALID_RECIPIENT" });
    return;
  }

  let relayerKp: Keypair;
  try {
    relayerKp = getRelayerKeypair();
  } catch (err) {
    req.log.error({ err }, "Relayer keypair load failed");
    res
      .status(500)
      .json({ error: "Relayer not configured", code: "RELAYER_NOT_CONFIGURED" });
    return;
  }

  try {
    const programId = new PublicKey(PROGRAM_ID);
    const secretBytes = Buffer.from(secret, "hex");
    const secretArr = Array.from(secretBytes);
    const commitmentBytes = commitmentFromSecretHex(secret);

    const [csPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("commitment_store")],
      programId,
    );
    const [nullifierPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("nullifier"), commitmentBytes],
      programId,
    );

    const store = await withRpcFallback(async (conn) => {
      const info = await conn.getAccountInfo(csPda, "confirmed");
      if (!info) throw new Error("Commitment store account not found");
      return parseStoreRaw(Buffer.from(info.data));
    });

    const entry = store.find(
      (e) => e.claimed === 0 && e.commitment.equals(commitmentBytes),
    );
    if (!entry) {
      res.status(404).json({
        error: "No matching unclaimed commitment found",
        code: "COMMITMENT_NOT_FOUND",
      });
      return;
    }

    const nowSec = BigInt(Math.floor(Date.now() / 1000));
    if (nowSec > entry.expiry) {
      res.status(410).json({ error: "Claim link has expired", code: "EXPIRED" });
      return;
    }

    const isSol = entry.tokenMint.equals(SOL_SENTINEL_BYTES);
    let signature: string;

    if (isSol) {
      signature = await withRpcFallback(async (conn) => {
        const provider = new AnchorProvider(conn, makeWallet(relayerKp), {
          commitment: "confirmed",
        });
        const idlWithAddress = {
          ...IDL,
          address: PROGRAM_ID,
          events: [],
        } as unknown as Idl;
        const program = new Program(idlWithAddress, provider);
        const methods = program.methods as unknown as PrivateTransferMethods;
        return methods
          .withdrawSol(secretArr)
          .accounts({
            commitmentStore: csPda,
            nullifierRecord: nullifierPda,
            recipient: recipientPk,
            relayer: relayerKp.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      });
    } else {
      const mintPk = new PublicKey(entry.tokenMint);
      const escrowAta = getAssociatedTokenAddressSync(
        mintPk,
        csPda,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      const recipientAta = getAssociatedTokenAddressSync(
        mintPk,
        recipientPk,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      );
      signature = await withRpcFallback(async (conn) => {
        const provider = new AnchorProvider(conn, makeWallet(relayerKp), {
          commitment: "confirmed",
        });
        const idlWithAddress = {
          ...IDL,
          address: PROGRAM_ID,
          events: [],
        } as unknown as Idl;
        const program = new Program(idlWithAddress, provider);
        const methods = program.methods as unknown as PrivateTransferMethods;
        return methods
          .withdrawSpl(secretArr)
          .accounts({
            commitmentStore: csPda,
            nullifierRecord: nullifierPda,
            recipient: recipientPk,
            tokenMint: mintPk,
            escrowTokenAccount: escrowAta,
            recipientTokenAccount: recipientAta,
            relayer: relayerKp.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      });
    }

    const explorerUrl =
      NETWORK_NAME === "mainnet-beta"
        ? `https://solscan.io/tx/${signature}`
        : `https://solscan.io/tx/${signature}?cluster=${NETWORK_NAME}`;
    res.json({ signature, explorerUrl });
  } catch (err) {
    req.log.error({ err }, "Withdraw tx failed");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message, code: "TX_FAILED" });
  }
});

export default router;
