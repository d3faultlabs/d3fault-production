import { Router } from "express";
import { Keypair, PublicKey } from "@solana/web3.js";
import { PROGRAM_ID, NETWORK_NAME } from "./relay";
import { withRpcFallback } from "../lib/rpc.js";

const router = Router();

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

router.get("/program-info", async (req, res) => {
  let relayerPublicKey = "not-configured";
  try {
    const rawKey = process.env["RELAYER_PRIVATE_KEY"];
    if (rawKey) {
      const parsed = JSON.parse(rawKey) as number[];
      relayerPublicKey = Keypair.fromSecretKey(Uint8Array.from(parsed)).publicKey.toBase58();
    }
  } catch {
    // Not configured
  }

  // Check the commitment store PDA state on-chain (with RPC fallback)
  let commitmentStoreState: "ready" | "stuck" | "clean" = "clean";
  try {
    const programId = new PublicKey(PROGRAM_ID);
    const [csPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("commitment_store")],
      programId
    );
    const info = await withRpcFallback((conn) => conn.getAccountInfo(csPda));
    if (!info) {
      commitmentStoreState = "clean";
    } else if (info.owner.toBase58() === programId.toBase58()) {
      commitmentStoreState = "ready";
    } else if (info.owner.toBase58() === SYSTEM_PROGRAM && info.lamports > 0) {
      commitmentStoreState = "stuck";
    } else {
      commitmentStoreState = "clean";
    }
  } catch {
    commitmentStoreState = "clean";
  }

  res.json({
    programId: PROGRAM_ID,
    network: NETWORK_NAME,
    relayerPublicKey,
    commitmentStoreState,
  });
});

export default router;
