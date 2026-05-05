import { Router } from "express";
import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { db, apiKeys, apiUsage } from "@workspace/db";
import { requireAuth, type AuthenticatedRequest } from "../../lib/privy-auth.js";
import { generateApiKey } from "../../lib/api-key-auth.js";

// Sub-router for /api/v1/auth/* — mounted under "/auth" so that requireAuth
// does NOT run for non-auth routes like /api/v1/program.
const router = Router();

router.use(requireAuth);

/** POST /api/v1/auth/keys — create a new API key */
router.post("/keys", async (req: AuthenticatedRequest, res) => {
  const userId = req.privyUserId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated", code: "UNAUTHORIZED" });
    return;
  }
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 80) {
    res.status(400).json({
      error: "name is required (1-80 chars)",
      code: "INVALID_NAME",
    });
    return;
  }

  const { fullKey, keyHash, keyPrefix } = generateApiKey();

  let inserted;
  try {
    const rows = await db
      .insert(apiKeys)
      .values({ userId, name, keyHash, keyPrefix })
      .returning();
    inserted = rows[0];
  } catch (err) {
    req.log.error({ err }, "Failed to create API key");
    res.status(500).json({
      error: "Failed to create key",
      code: "DB_ERROR",
    });
    return;
  }
  if (!inserted) {
    res.status(500).json({ error: "Insert returned no row", code: "DB_ERROR" });
    return;
  }

  res.status(201).json({
    id: inserted.id,
    name: inserted.name,
    key: fullKey,
    prefix: inserted.keyPrefix,
    createdAt: inserted.createdAt.toISOString(),
  });
});

/** GET /api/v1/auth/keys — list user's keys (no full key, only prefix) */
router.get("/keys", async (req: AuthenticatedRequest, res) => {
  const userId = req.privyUserId!;
  try {
    const rows = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.keyPrefix,
        rateLimit: apiKeys.rateLimit,
        lastUsedAt: apiKeys.lastUsedAt,
        usageCount: apiKeys.usageCount,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt));
    res.json({
      keys: rows.map((r) => ({
        id: r.id,
        name: r.name,
        prefix: r.prefix,
        rateLimit: r.rateLimit,
        lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
        usageCount: r.usageCount,
        revokedAt: r.revokedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list API keys");
    res.status(500).json({ error: "Failed to list keys", code: "DB_ERROR" });
  }
});

/** DELETE /api/v1/auth/keys/:id — revoke a key (soft delete) */
router.delete("/keys/:id", async (req: AuthenticatedRequest, res) => {
  const userId = req.privyUserId!;
  const id = req.params["id"];
  if (typeof id !== "string" || !id) {
    res.status(400).json({ error: "id required", code: "INVALID_REQUEST" });
    return;
  }
  try {
    const updated = await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
      .returning({ id: apiKeys.id });
    if (updated.length === 0) {
      res.status(404).json({ error: "Key not found", code: "NOT_FOUND" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to revoke API key");
    res.status(500).json({ error: "Failed to revoke key", code: "DB_ERROR" });
  }
});

/** GET /api/v1/auth/keys/usage — hourly usage for the last 24h for this user */
router.get("/keys/usage", async (req: AuthenticatedRequest, res) => {
  const userId = req.privyUserId!;
  try {
    const userKeys = await db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));
    const keyIds = userKeys.map((k) => k.id);

    // Build empty 24h window of points so the chart always renders.
    const now = new Date();
    const points: Array<{ hour: string; requests: number; errors: number }> = [];
    for (let i = 23; i >= 0; i--) {
      const t = new Date(now.getTime() - i * 60 * 60 * 1000);
      points.push({
        hour: `${t.getUTCHours().toString().padStart(2, "0")}:00`,
        requests: 0,
        errors: 0,
      });
    }

    if (keyIds.length === 0) {
      res.json({ points, totalRequests: 0, totalErrors: 0 });
      return;
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        bucket: sql<string>`to_char(date_trunc('hour', ${apiUsage.ts}), 'YYYY-MM-DD HH24:00')`,
        requests: sql<number>`count(*)::int`,
        errors: sql<number>`count(*) filter (where ${apiUsage.statusCode} >= 400)::int`,
      })
      .from(apiUsage)
      .where(
        and(
          sql`${apiUsage.apiKeyId} = ANY(${keyIds})`,
          gte(apiUsage.ts, since),
        ),
      )
      .groupBy(sql`date_trunc('hour', ${apiUsage.ts})`)
      .orderBy(sql`date_trunc('hour', ${apiUsage.ts})`);

    let totalRequests = 0;
    let totalErrors = 0;
    for (const r of rows) {
      totalRequests += r.requests;
      totalErrors += r.errors;
      // Map each row into its corresponding hour bucket.
      const hh = r.bucket.slice(11, 16);
      const idx = points.findIndex((p) => p.hour === hh);
      if (idx >= 0) {
        const point = points[idx];
        if (point) {
          point.requests = r.requests;
          point.errors = r.errors;
        }
      }
    }

    res.json({ points, totalRequests, totalErrors });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch usage");
    res.status(500).json({ error: "Failed to fetch usage", code: "DB_ERROR" });
  }
});

// Mark `isNull` as used so type-checker doesn't complain in case future
// changes drop its references; safe no-op.
void isNull;

export default router;
