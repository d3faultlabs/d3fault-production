import { Router } from "express";
import { Keypair, PublicKey } from "@solana/web3.js";
import { withRpcFallback } from "../../lib/rpc.js";
import { PROGRAM_ID, NETWORK_NAME } from "../relay.js";

const router = Router();

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

router.get("/program", async (_req, res) => {
  let relayerPubkey = "not-configured";
  try {
    const rawKey = process.env["RELAYER_PRIVATE_KEY"];
    if (rawKey) {
      const parsed = JSON.parse(rawKey) as number[];
      relayerPubkey = Keypair.fromSecretKey(
        Uint8Array.from(parsed),
      ).publicKey.toBase58();
    }
  } catch {
    // ignore
  }

  let storeState: "ready" | "stuck" | "clean" = "clean";
  try {
    const programId = new PublicKey(PROGRAM_ID);
    const [csPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("commitment_store")],
      programId,
    );
    const info = await withRpcFallback((conn) => conn.getAccountInfo(csPda));
    if (!info) {
      storeState = "clean";
    } else if (info.owner.toBase58() === programId.toBase58()) {
      storeState = "ready";
    } else if (
      info.owner.toBase58() === SYSTEM_PROGRAM &&
      info.lamports > 0
    ) {
      storeState = "stuck";
    }
  } catch {
    // network error → leave as clean
  }

  res.json({
    programId: PROGRAM_ID,
    network: NETWORK_NAME,
    relayerPubkey,
    storeState,
  });
});

export default router;
