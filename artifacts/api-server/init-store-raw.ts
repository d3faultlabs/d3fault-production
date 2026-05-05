import { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const getArg = (flag: string): string | null => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};

const PROGRAM_ID = getArg("--program") ?? "2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG";
const KEYPAIR_PATH = getArg("--keypair") ?? `${homedir()}/.config/solana/id.json`;
const RPC = getArg("--rpc") ?? "https://api.mainnet-beta.solana.com";

async function main() {
  console.log("\n=== D3FAULT CommitmentStore Initializer ===\n");

  const raw = JSON.parse(readFileSync(KEYPAIR_PATH, "utf-8")) as number[];
  const payer = Keypair.fromSecretKey(Uint8Array.from(raw));

  const programId = new PublicKey(PROGRAM_ID);
  const connection = new Connection(RPC, "confirmed");

  console.log(`  Program   : ${PROGRAM_ID}`);
  console.log(`  Payer     : ${payer.publicKey.toBase58()}`);
  console.log(`  RPC       : ${RPC}`);

  const balance = await connection.getBalance(payer.publicKey);
  console.log(`  Balance   : ${(balance / 1e9).toFixed(4)} SOL`);

  if (balance < 0.25e9) {
    console.error(`\nERROR: Need at least 0.25 SOL`);
    process.exit(1);
  }

  const [storePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("commitment_store")],
    programId
  );
  console.log(`\n  Store PDA : ${storePda.toBase58()}`);

  const existing = await connection.getAccountInfo(storePda);
  if (existing !== null) {
    console.log(`\n  Already initialized!`);
    console.log(`  Size: ${existing.data.length} bytes`);
    return;
  }

  // Anchor discriminator for "initialize": sha256("global:initialize")[0..8]
  const discriminator = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

  const ix = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: storePda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: discriminator,
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ blockhash, lastValidBlockHeight, feePayer: payer.publicKey });
  tx.add(ix);
  tx.sign(payer);

  console.log("\n  Sending initialize transaction...");
  const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");

  console.log(`\n  Signature : ${sig}`);
  console.log(`  Explorer  : https://solscan.io/tx/${sig}`);

  const account = await connection.getAccountInfo(storePda);
  if (account) {
    console.log(`\n  CommitmentStore initialized!`);
    console.log(`  PDA  : ${storePda.toBase58()}`);
    console.log(`  Size : ${account.data.length} bytes (expected 30,744)`);
    console.log(`  Rent : ${(account.lamports / 1e9).toFixed(4)} SOL`);
  }
}

main().catch((err) => {
  console.error("\nFATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
