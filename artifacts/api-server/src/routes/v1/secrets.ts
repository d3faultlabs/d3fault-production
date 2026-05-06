import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";

const router = Router();

/**
 * Development/testing helper — generates a secret + commitment server-side.
 *
 * PRIVACY WARNING: The server sees this secret in plaintext. For real deposits,
 * always generate the secret in the browser using the Web Crypto API so it
 * never leaves the client. This endpoint exists for API testing and SDK
 * integration workflows only.
 *
 * Client-side equivalent (copy this into your app):
 *
 *   const secret = crypto.getRandomValues(new Uint8Array(32));
 *   const commitment = await crypto.subtle.digest("SHA-256", secret);
 */
router.post("/secrets/generate", (_req, res) => {
  const secret = randomBytes(32);
  const commitment = createHash("sha256").update(secret).digest();

  res.setHeader(
    "X-Privacy-Warning",
    "Secret generated server-side — for testing only. Generate client-side for real deposits."
  );

  res.json({
    secret: secret.toString("hex"),
    commitment: commitment.toString("hex"),
    _warning:
      "This secret was generated on the server. For production use, generate secrets client-side so the server never sees them. See docs for the browser Web Crypto equivalent.",
  });
});

export default router;
