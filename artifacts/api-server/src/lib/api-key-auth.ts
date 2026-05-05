import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";
import { db, apiKeys, apiUsage } from "@workspace/db";
import { logger } from "./logger.js";

export interface ApiKeyContext {
  id: string;
  userId: string;
  scopes: string[];
  rateLimit: number;
  prefix: string;
}

export interface ApiKeyRequest extends Request {
  apiKey?: ApiKeyContext;
}

const KEY_PREFIX = "dfk_live_";
const RAW_BYTE_LEN = 24; // 24 random bytes → 32 base64url chars

/**
 * Generate a fresh full-form API key string of the form:
 *   dfk_live_<32-base64url-chars>
 */
export function generateApiKey(): { fullKey: string; keyHash: string; keyPrefix: string } {
  const raw = randomBytes(RAW_BYTE_LEN)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const fullKey = `${KEY_PREFIX}${raw}`;
  const keyHash = createHash("sha256").update(fullKey).digest("hex");
  const keyPrefix = fullKey.slice(0, KEY_PREFIX.length + 4); // dfk_live_xxxx
  return { fullKey, keyHash, keyPrefix };
}

export function hashKey(fullKey: string): string {
  return createHash("sha256").update(fullKey).digest("hex");
}

/**
 * Express middleware that authenticates a request via an API key Bearer token.
 *  - 401 if no valid `Authorization: Bearer dfk_…` header
 *  - 403 if the key is revoked
 *  - On success, attaches `req.apiKey` and records usage post-response.
 */
export async function requireApiKey(
  req: ApiKeyRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers["authorization"];
  if (!header || !header.startsWith("Bearer ")) {
    res
      .status(401)
      .json({ error: "Missing Bearer API key", code: "UNAUTHORIZED" });
    return;
  }
  const token = header.slice(7).trim();
  if (!token.startsWith(KEY_PREFIX)) {
    res
      .status(401)
      .json({ error: "Invalid API key format", code: "INVALID_KEY" });
    return;
  }

  const keyHash = hashKey(token);

  let row;
  try {
    const rows = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, keyHash))
      .limit(1);
    row = rows[0];
  } catch (err) {
    logger.error({ err }, "API key lookup failed");
    res
      .status(500)
      .json({ error: "Auth lookup failed", code: "AUTH_LOOKUP_FAILED" });
    return;
  }

  if (!row) {
    res
      .status(401)
      .json({ error: "Invalid API key", code: "INVALID_KEY" });
    return;
  }
  if (row.revokedAt) {
    res
      .status(403)
      .json({ error: "API key has been revoked", code: "KEY_REVOKED" });
    return;
  }

  req.apiKey = {
    id: row.id,
    userId: row.userId,
    scopes: row.scopes,
    rateLimit: row.rateLimit,
    prefix: row.keyPrefix,
  };

  // Update last_used_at + usage_count fire-and-forget.
  void db
    .update(apiKeys)
    .set({ lastUsedAt: new Date(), usageCount: sql`${apiKeys.usageCount} + 1` })
    .where(eq(apiKeys.id, row.id))
    .catch((err) => logger.warn({ err }, "Failed to bump api_keys usage"));

  // Record usage row when response finishes.
  res.on("finish", () => {
    void db
      .insert(apiUsage)
      .values({
        apiKeyId: row.id,
        endpoint: `${req.method} ${req.baseUrl}${req.path}`,
        statusCode: res.statusCode,
      })
      .catch((err) => logger.warn({ err }, "Failed to insert api_usage"));
  });

  next();
}
