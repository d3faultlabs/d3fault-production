import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { withRpcFallback } from "./rpc.js";
import { PROGRAM_ID } from "../routes/relay.js";

/** Protocol fee charged on private SOL deposits (0.25%). */
export const PROTOCOL_FEE_BPS = 25;

/** Flat protocol fee for SPL deposits (0.0021 SOL = 2_100_000 lamports). */
export const SPL_FEE_LAMPORTS = 2_100_000n;

/** Wallet that receives the protocol fee. Equals our relayer wallet. */
export const RELAYER_FEE_PUBKEY = new PublicKey(
  "EV7T58wSE5rz9a2psrCXaEL5G2X2aUT76Q9hemyWoDTt",
);

/** Anchor instruction discriminators (sha256("global:<name>")[0..8]). */
const DEPOSIT_SOL_DISC = new Uint8Array([
  0x6c, 0x51, 0x4e, 0x75, 0x7d, 0x9b, 0x38, 0xc8,
]);
const DEPOSIT_SPL_DISC = new Uint8Array([
  0xe0, 0x00, 0xc6, 0xaf, 0xc6, 0x2f, 0x69, 0xcc,
]);

const SOL_SENTINEL_MINT = "11111111111111111111111111111111";

/** Compute commitment = sha256(secret-bytes). */
export function commitmentFromSecretHex(secretHex: string): Buffer {
  return createHash("sha256").update(Buffer.from(secretHex, "hex")).digest();
}

function buildSystemTransferIx(
  from: PublicKey,
  to: PublicKey,
  lamports: bigint,
): TransactionInstruction {
  const data = Buffer.alloc(12);
  data.writeUInt32LE(2, 0); // System Transfer instruction id
  data.writeBigInt64LE(lamports, 4);
  return new TransactionInstruction({
    programId: SystemProgram.programId,
    keys: [
      { pubkey: from, isSigner: true, isWritable: true },
      { pubkey: to, isSigner: false, isWritable: true },
    ],
    data,
  });
}

function buildDepositSolIx(args: {
  programId: PublicKey;
  csPda: PublicKey;
  depositor: PublicKey;
  commitment: Uint8Array;
  lamports: bigint;
  expiry: bigint;
}): TransactionInstruction {
  const data = new Uint8Array(56);
  const dv = new DataView(data.buffer);
  data.set(DEPOSIT_SOL_DISC, 0);
  data.set(args.commitment, 8);
  dv.setBigUint64(40, args.lamports, true);
  dv.setBigInt64(48, args.expiry, true);
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      { pubkey: args.csPda, isSigner: false, isWritable: true },
      { pubkey: args.depositor, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

function buildDepositSplIx(args: {
  programId: PublicKey;
  csPda: PublicKey;
  depositor: PublicKey;
  mint: PublicKey;
  depositorAta: PublicKey;
  escrowAta: PublicKey;
  commitment: Uint8Array;
  amount: bigint;
  expiry: bigint;
}): TransactionInstruction {
  const data = new Uint8Array(56);
  const dv = new DataView(data.buffer);
  data.set(DEPOSIT_SPL_DISC, 0);
  data.set(args.commitment, 8);
  dv.setBigUint64(40, args.amount, true);
  dv.setBigInt64(48, args.expiry, true);
  return new TransactionInstruction({
    programId: args.programId,
    keys: [
      { pubkey: args.csPda, isSigner: false, isWritable: true },
      { pubkey: args.depositor, isSigner: true, isWritable: true },
      { pubkey: args.mint, isSigner: false, isWritable: false },
      { pubkey: args.depositorAta, isSigner: false, isWritable: true },
      { pubkey: args.escrowAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(data),
  });
}

/**
 * Build an unsigned base64-serialized SOL deposit transaction.
 * Includes: protocol fee transfer (depositor → relayer) + deposit_sol instruction.
 */
export async function buildDepositSolTx(args: {
  depositor: string;
  amountLamports: bigint;
  expiry: bigint;
  commitment: Uint8Array;
}): Promise<{ txBase64: string; feeLamports: bigint }> {
  const programId = new PublicKey(PROGRAM_ID);
  const depositor = new PublicKey(args.depositor);
  const [csPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("commitment_store")],
    programId,
  );
  const feeLamports =
    (args.amountLamports * BigInt(PROTOCOL_FEE_BPS)) / 10000n;

  const tx = new Transaction();
  tx.add(buildSystemTransferIx(depositor, RELAYER_FEE_PUBKEY, feeLamports));
  tx.add(
    buildDepositSolIx({
      programId,
      csPda,
      depositor,
      commitment: args.commitment,
      lamports: args.amountLamports,
      expiry: args.expiry,
    }),
  );

  const { blockhash } = await withRpcFallback((conn) =>
    conn.getLatestBlockhash(),
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer = depositor;

  const serialized = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  return {
    txBase64: Buffer.from(serialized).toString("base64"),
    feeLamports,
  };
}

/**
 * Build an unsigned base64-serialized SPL deposit transaction.
 * Includes: protocol fee transfer (flat 0.0021 SOL → relayer) + deposit_spl instruction.
 */
export async function buildDepositSplTx(args: {
  depositor: string;
  mint: string;
  amount: bigint;
  expiry: bigint;
  commitment: Uint8Array;
}): Promise<{ txBase64: string; feeLamports: bigint }> {
  if (args.mint === SOL_SENTINEL_MINT) {
    throw new Error("Use deposit-sol/build for native SOL");
  }
  const programId = new PublicKey(PROGRAM_ID);
  const depositor = new PublicKey(args.depositor);
  const mint = new PublicKey(args.mint);
  const [csPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("commitment_store")],
    programId,
  );
  const depositorAta = getAssociatedTokenAddressSync(
    mint,
    depositor,
    false,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const escrowAta = getAssociatedTokenAddressSync(
    mint,
    csPda,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const tx = new Transaction();
  tx.add(
    buildSystemTransferIx(depositor, RELAYER_FEE_PUBKEY, SPL_FEE_LAMPORTS),
  );
  tx.add(
    buildDepositSplIx({
      programId,
      csPda,
      depositor,
      mint,
      depositorAta,
      escrowAta,
      commitment: args.commitment,
      amount: args.amount,
      expiry: args.expiry,
    }),
  );

  const { blockhash } = await withRpcFallback((conn) =>
    conn.getLatestBlockhash(),
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer = depositor;

  const serialized = tx.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });
  return {
    txBase64: Buffer.from(serialized).toString("base64"),
    feeLamports: SPL_FEE_LAMPORTS,
  };
}
