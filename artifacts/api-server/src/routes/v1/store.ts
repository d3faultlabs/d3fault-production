import { Router } from "express";
import { PublicKey } from "@solana/web3.js";
import { withRpcFallback } from "../../lib/rpc.js";
import { PROGRAM_ID } from "../relay.js";

const router = Router();

const ENTRY_SIZE = 120;
const NUM_SLOTS = 64;
const SOL_SENTINEL_BYTES = Buffer.alloc(32, 0);

interface ParsedEntry {
  commitment: string;
  amount: string;
  expiry: number;
  tokenMint: string; // base58 (or "11111111111111111111111111111111" sentinel)
  claimed: boolean;
  depositor: string;
}

function bytesToHex(b: Buffer | Uint8Array): string {
  return Buffer.from(b).toString("hex");
}

function parseStore(data: Buffer): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  let off = 8; // discriminator
  off += 16; // count + head u64s
  for (let i = 0; i < NUM_SLOTS; i++) {
    const base = off + i * ENTRY_SIZE;
    const commitmentBytes = data.slice(base, base + 32);
    const amount = data.readBigUInt64LE(base + 32);
    const expiry = data.readBigInt64LE(base + 40);
    const tokenMint = data.slice(base + 48, base + 80);
    const claimed = data.readUInt8(base + 80) === 1;
    const depositor = data.slice(base + 88, base + 120);

    if (amount === 0n && !claimed) continue; // never-used slot

    const isSol = tokenMint.equals(SOL_SENTINEL_BYTES);
    entries.push({
      commitment: bytesToHex(commitmentBytes),
      amount: amount.toString(),
      expiry: Number(expiry),
      tokenMint: isSol
        ? "11111111111111111111111111111111"
        : new PublicKey(tokenMint).toBase58(),
      claimed,
      depositor: new PublicKey(depositor).toBase58(),
    });
  }
  return entries;
}

async function loadEntries(): Promise<ParsedEntry[]> {
  const programId = new PublicKey(PROGRAM_ID);
  const [csPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("commitment_store")],
    programId,
  );
  return withRpcFallback(async (conn) => {
    const info = await conn.getAccountInfo(csPda, "confirmed");
    if (!info) return [];
    return parseStore(Buffer.from(info.data));
  });
}

router.get("/store/commitments", async (req, res) => {
  const status = (req.query["status"] as string | undefined) ?? "all";
  if (!["all", "active", "claimed", "expired"].includes(status)) {
    res.status(400).json({
      error: "status must be one of: all, active, claimed, expired",
      code: "INVALID_STATUS",
    });
    return;
  }
  try {
    const entries = await loadEntries();
    const now = Math.floor(Date.now() / 1000);
    const filtered = entries.filter((e) => {
      if (status === "all") return true;
      if (status === "claimed") return e.claimed;
      if (status === "active") return !e.claimed && e.expiry > now;
      if (status === "expired") return !e.claimed && e.expiry <= now;
      return true;
    });
    res.json(filtered);
  } catch (err) {
    req.log.error({ err }, "store/commitments failed");
    res
      .status(500)
      .json({ error: "Failed to read commitment store", code: "RPC_ERROR" });
  }
});

router.get("/store/lookup/:commitment", async (req, res) => {
  const raw = req.params["commitment"];
  const commitment = typeof raw === "string" ? raw.toLowerCase() : "";
  if (!commitment || !/^[0-9a-f]{64}$/.test(commitment)) {
    res.status(400).json({
      error: "commitment must be 64-char hex",
      code: "INVALID_COMMITMENT",
    });
    return;
  }
  try {
    const entries = await loadEntries();
    const found = entries.find((e) => e.commitment === commitment);
    if (!found) {
      res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
      return;
    }
    res.json(found);
  } catch (err) {
    req.log.error({ err }, "store/lookup failed");
    res
      .status(500)
      .json({ error: "Failed to read commitment store", code: "RPC_ERROR" });
  }
});

export default router;
