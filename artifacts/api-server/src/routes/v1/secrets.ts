import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";

const router = Router();

/**
 * Server-side helper to mint a fresh secret + its commitment.
 *
 * NOTE: Generating a secret on the server means *we* see it. Strongly prefer
 * generating client-side for true privacy — see docs.
 */
router.post("/secrets/generate", (_req, res) => {
  const secret = randomBytes(32);
  const commitment = createHash("sha256").update(secret).digest();
  res.json({
    secret: secret.toString("hex"),
    commitment: commitment.toString("hex"),
  });
});

export default router;
