import { Router, type IRouter } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { requireApiKey, type ApiKeyRequest } from "../../lib/api-key-auth.js";
import authKeysRouter from "./auth-keys.js";
import programRouter from "./program.js";
import storeRouter from "./store.js";
import secretsRouter from "./secrets.js";
import txRouter from "./tx.js";
import priceRouter from "./price.js";

const router: IRouter = Router();

// ── /api/v1/auth/* (Privy-authenticated key management) ──────────────────────
// Mounted under "/auth" so the privy-auth middleware does NOT intercept the
// public Bearer-API-key routes mounted later (program/store/tx/etc).
router.use("/auth", authKeysRouter);

// ── Per-key rate limiter for /api/v1/* public endpoints ──────────────────────
const apiKeyLimiter = rateLimit({
  windowMs: 60 * 1000,
  standardHeaders: true,
  legacyHeaders: false,
  // Use the api key id as the bucket key (set by requireApiKey).
  keyGenerator: (req, res) => {
    const apiKey = (req as ApiKeyRequest).apiKey;
    if (apiKey?.id) return apiKey.id;
    return ipKeyGenerator(req.ip ?? "");
  },
  // Per-key max from the api_keys.rate_limit column.
  max: (req) => (req as ApiKeyRequest).apiKey?.rateLimit ?? 60,
  message: {
    error: "Rate limit exceeded — try again in a minute",
    code: "RATE_LIMITED",
  },
});

// All routes below require a Bearer dfk_… API key + rate-limited per key.
router.use(requireApiKey);
router.use(apiKeyLimiter);

router.use(programRouter);
router.use(storeRouter);
router.use(secretsRouter);
router.use(txRouter);
router.use(priceRouter);

export default router;
