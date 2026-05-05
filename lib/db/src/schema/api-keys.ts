import {
  pgTable,
  text,
  integer,
  timestamp,
  uuid,
  bigserial,
  index,
} from "drizzle-orm/pg-core";

/**
 * D3FAULT public API keys.
 *
 * - `keyHash` is sha256(fullKey). The full key is shown to the user once at
 *   creation time and never stored.
 * - `keyPrefix` is the first ~12 characters of the full key, kept for display
 *   purposes ("dfk_live_xxxx…").
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    scopes: text("scopes").array().notNull().default(["read", "write"]),
    rateLimit: integer("rate_limit").notNull().default(60),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    usageCount: integer("usage_count").notNull().default(0),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("api_keys_user_idx").on(t.userId)],
);

/**
 * Append-only log of api request usage. One row per request.
 * Used to render the per-key usage chart on the Developers tab.
 */
export const apiUsage = pgTable(
  "api_usage",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    apiKeyId: uuid("api_key_id")
      .notNull()
      .references(() => apiKeys.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    statusCode: integer("status_code").notNull(),
    ts: timestamp("ts", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("api_usage_key_ts_idx").on(t.apiKeyId, t.ts)],
);

export type ApiKey = typeof apiKeys.$inferSelect;
export type ApiUsage = typeof apiUsage.$inferSelect;
