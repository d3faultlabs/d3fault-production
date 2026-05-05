#!/usr/bin/env tsx
/**
 * D3FAULT — Initialize CommitmentStore after program deployment
 *
 * Call this ONCE after deploying the private_transfer program to any cluster.
 * It creates the global CommitmentStore PDA (28,952 bytes, ~0.20 SOL rent on mainnet).
 *
 * Usage:
 *   npx tsx program/scripts/init-store.ts [options]
 *
 * Options:
 *   --program <address>   Program ID (default: 2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG)
 *   --keypair <path>      Payer keypair JSON (default: ~/.config/solana/id.json)
 *   --rpc     <url>       RPC endpoint (default: https://api.mainnet-beta.solana.com)
 *
 * Examples:
 *   # Mainnet (default RPC)
 *   npx tsx program/scripts/init-store.ts
 *
 *   # Devnet
 *   npx tsx program/scripts/init-store.ts --rpc https://api.devnet.solana.com
 *
 *   # Custom keypair + premium RPC
 *   npx tsx program/scripts/init-store.ts \
 *     --keypair ~/deployer.json \
 *     --rpc https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { AnchorProvider, Program, Wallet, type Idl } from "@coral-xyz/anchor";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

// ── IDL (inline — avoids needing compiled target/idl/ file) ─────────────────

const IDL = {
  address: "2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG",
  metadata: { name: "private_transfer", version: "0.1.0", spec: "0.1.0" },
  instructions: [
    {
      name: "initialize",
      accounts: [
        { name: "commitmentStore", writable: true },
        { name: "authority", writable: true, signer: true },
        { name: "systemProgram", address: "11111111111111111111111111111111" },
      ],
      args: [],
    },
  ],
  accounts: [
    { name: "CommitmentStore", discriminator: [0, 0, 0, 0, 0, 0, 0, 0] },
  ],
  types: [
    {
      name: "CommitmentStore",
      type: {
        kind: "struct",
        fields: [
          { name: "count", type: "u64" },
          { name: "head", type: "u64" },
        ],
      },
    },
  ],
  errors: [],
  events: [],
} as const;

// ── Arg parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const getArg = (flag: string): string | null => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const PROGRAM_ID = getArg("--program") ?? "2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG";
const KEYPAIR_PATH = getArg("--keypair") ?? `${homedir()}/.config/solana/id.json`;
const RPC = getArg("--rpc") ?? "https://api.mainnet-beta.solana.com";

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n=== D3FAULT CommitmentStore Initializer ===\n");

  // Load payer keypair
  let payer: Keypair;
  try {
    const raw = JSON.parse(readFileSync(KEYPAIR_PATH, "utf-8")) as number[];
    payer = Keypair.fromSecretKey(Uint8Array.from(raw));
  } catch (err) {
    console.error(`ERROR: Could not load keypair from ${KEYPAIR_PATH}`);
    console.error("  Provide a funded keypair with --keypair <path>");
    process.exit(1);
  }

  const programId = new PublicKey(PROGRAM_ID);
  const connection = new Connection(RPC, "confirmed");

  console.log(`  Program   : ${PROGRAM_ID}`);
  console.log(`  Payer     : ${payer.publicKey.toBase58()}`);
  console.log(`  RPC       : ${RPC}`);

  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log(`  Balance   : ${(balance / 1e9).toFixed(4)} SOL`);

  const MIN_SOL = 0.25e9; // 0.25 SOL covers ~0.20 SOL rent + gas
  if (balance < MIN_SOL) {
    console.error(
      `\nERROR: Insufficient balance. Need at least 0.25 SOL (have ${(balance / 1e9).toFixed(4)} SOL).`
    );
    process.exit(1);
  }

  // Derive CommitmentStore PDA
  const [storePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("commitment_store")],
    programId
  );
  console.log(`\n  Store PDA : ${storePda.toBase58()}`);

  // Check if already initialized
  const existing = await connection.getAccountInfo(storePda);
  if (existing !== null) {
    console.log(`\n  Already initialized!`);
    console.log(`  Account size : ${existing.data.length} bytes`);
    console.log(`  Owner        : ${existing.owner.toBase58()}`);
    if (existing.data.length !== 28952) {
      console.warn(
        `  WARNING: Expected 28,952 bytes (ring buffer layout), got ${existing.data.length}.`
      );
      console.warn(`  The deployed program may be using a different layout.`);
    }
    return;
  }

  // Build Anchor provider + program
  const wallet = new Wallet(payer);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const idlWithAddress = { ...IDL, address: PROGRAM_ID } as unknown as Idl;
  const program = new Program(idlWithAddress, provider);

  console.log("\n  Sending initialize transaction...");

  const sig = await (program.methods as any)
    .initialize()
    .accounts({
      commitmentStore: storePda,
      authority: payer.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([payer])
    .rpc({ commitment: "confirmed" });

  console.log(`\n  Signature : ${sig}`);

  const cluster = RPC.includes("devnet") ? "devnet" : RPC.includes("testnet") ? "testnet" : "";
  const clusterParam = cluster ? `?cluster=${cluster}` : "";
  console.log(`  Explorer  : https://solscan.io/tx/${sig}${clusterParam}`);

  // Verify
  const account = await connection.getAccountInfo(storePda);
  if (account) {
    console.log(`\n  CommitmentStore initialized!`);
    console.log(`  PDA      : ${storePda.toBase58()}`);
    console.log(`  Size     : ${account.data.length} bytes (expected 28,952)`);
    console.log(`  Rent     : ~${((account.lamports) / 1e9).toFixed(4)} SOL`);
    console.log(`\n  Next: set these env vars in your API server:`);
    console.log(`    PROGRAM_ID=${PROGRAM_ID}`);
    console.log(
      `    SOLANA_NETWORK=${cluster || "mainnet-beta"}`
    );
    console.log(`    SOLANA_RPC_ENDPOINT=${RPC}`);
  } else {
    console.error("\n  ERROR: Account not found after initialization. Check the transaction.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nFATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
