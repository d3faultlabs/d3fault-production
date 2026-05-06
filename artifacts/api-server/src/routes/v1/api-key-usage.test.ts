import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

// Mutable stores shared between the DB mock and test assertions.
const stores = vi.hoisted(() => ({
  apiKeys: [] as Record<string, unknown>[],
  apiUsage: [] as Record<string, unknown>[],
}));

// Replace drizzle condition builders with plain descriptors so the in-memory
// mock can evaluate WHERE clauses without a real SQL engine.
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: (col: unknown, val: unknown) => ({ _op: "eq", col, val }),
    and: (...args: unknown[]) => ({ _op: "and", args }),
    gte: (col: unknown, val: unknown) => ({ _op: "gte", col, val }),
    isNull: (col: unknown) => ({ _op: "isNull", col }),
    desc: (col: unknown) => ({ _op: "desc", col }),
  };
});

function match(row: Record<string, unknown>, cond: unknown): boolean {
  if (!cond || typeof cond !== "object") return true;
  const c = cond as Record<string, unknown>;
  if (c["_op"] === "eq") return row[c["col"] as string] === c["val"];
  if (c["_op"] === "and") return (c["args"] as unknown[]).every((a) => match(row, a));
  if (c["_op"] === "gte") return (row[c["col"] as string] as Date) >= (c["val"] as Date);
  if (c["_op"] === "isNull") return row[c["col"] as string] == null;
  return true; // raw sql() fragments — pass through
}

let rowSeq = 0;

vi.mock("@workspace/db", () => {
  const apiKeys = {
    _table: "api_keys",
    id: "id", userId: "userId", keyHash: "keyHash", keyPrefix: "keyPrefix",
    name: "name", scopes: "scopes", rateLimit: "rateLimit",
    lastUsedAt: "lastUsedAt", usageCount: "usageCount",
    revokedAt: "revokedAt", createdAt: "createdAt",
  };
  const apiUsage = {
    _table: "api_usage",
    id: "id", apiKeyId: "apiKeyId", endpoint: "endpoint",
    statusCode: "statusCode", ts: "ts",
  };

  function storeFor(t: Record<string, unknown>) {
    return t["_table"] === "api_keys" ? stores.apiKeys : stores.apiUsage;
  }

  function selectChain(table: Record<string, unknown>) {
    const store = storeFor(table);
    let cond: unknown = null;
    const chain: Record<string, unknown> = {
      where(c: unknown) { cond = c; return chain; },
      async limit(n: number) { return store.filter((r) => match(r, cond)).slice(0, n); },
      orderBy(..._: unknown[]) {
        return Promise.resolve(store.filter((r) => match(r, cond)));
      },
      groupBy(..._: unknown[]) {
        return {
          orderBy: async (...__: unknown[]) => {
            const rows = store.filter((r) => match(r, cond));
            const buckets = new Map<string, { requests: number; errors: number }>();
            for (const row of rows) {
              const d = new Date(row["ts"] as string | Date);
              const key =
                `${d.getUTCFullYear()}-` +
                `${String(d.getUTCMonth() + 1).padStart(2, "0")}-` +
                `${String(d.getUTCDate()).padStart(2, "0")} ` +
                `${String(d.getUTCHours()).padStart(2, "0")}:00`;
              if (!buckets.has(key)) buckets.set(key, { requests: 0, errors: 0 });
              const b = buckets.get(key)!;
              b.requests++;
              if ((row["statusCode"] as number) >= 400) b.errors++;
            }
            return [...buckets.entries()].map(([bucket, d]) => ({ bucket, ...d }));
          },
        };
      },
      then(res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) {
        return Promise.resolve(store.filter((r) => match(r, cond))).then(res, rej);
      },
    };
    return chain;
  }

  function insertChain(table: Record<string, unknown>, data: Record<string, unknown>) {
    const store = storeFor(table);
    const row: Record<string, unknown> = {
      id: `id-${++rowSeq}`,
      scopes: ["read", "write"], rateLimit: 60, usageCount: 0,
      revokedAt: null, lastUsedAt: null,
      ts: new Date(), createdAt: new Date(),
      ...data,
    };
    // Push immediately so the res.on("finish") callback is synchronous.
    store.push(row);
    const p = Promise.resolve([row]);
    return { returning: () => p, then: p.then.bind(p), catch: p.catch.bind(p) };
  }

  function updateChain(table: Record<string, unknown>, patch: Record<string, unknown>) {
    const store = storeFor(table);
    return {
      where(cond: unknown) {
        const updated: Record<string, unknown>[] = [];
        for (const row of store) {
          if (!match(row, cond)) continue;
          for (const [k, v] of Object.entries(patch)) {
            // Skip drizzle sql() increment expressions (e.g. usageCount += 1).
            if (v && typeof v === "object" && "queryChunks" in (v as object)) continue;
            row[k] = v;
          }
          updated.push(row);
        }
        const p = Promise.resolve(updated);
        return { returning: () => p, then: p.then.bind(p), catch: p.catch.bind(p) };
      },
    };
  }

  return {
    db: {
      select: (_?: unknown) => ({ from: (t: Record<string, unknown>) => selectChain(t) }),
      insert: (t: Record<string, unknown>) => ({ values: (d: Record<string, unknown>) => insertChain(t, d) }),
      update: (t: Record<string, unknown>) => ({ set: (p: Record<string, unknown>) => updateChain(t, p) }),
    },
    apiKeys,
    apiUsage,
  };
});

vi.mock("../../lib/privy-auth.js", () => ({
  requireAuth: (req: Record<string, unknown>, _res: unknown, next: () => void) => {
    req["privyUserId"] = "user-42";
    next();
  },
}));

vi.mock("../../lib/logger.js", () => ({
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined },
}));

vi.mock("../../lib/program-helpers.js", () => ({
  buildDepositSolTx: vi.fn(), buildDepositSplTx: vi.fn(),
  PROTOCOL_FEE_BPS: 25, SPL_FEE_LAMPORTS: 2_100_000n,
  RELAYER_FEE_PUBKEY: { toBase58: () => "EV7T58wSE5rz9a2psrCXaEL5G2X2aUT76Q9hemyWoDTt" },
}));

vi.mock("../relay.js", () => ({
  PROGRAM_ID: "D3FAULTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  NETWORK_NAME: "devnet",
}));

vi.mock("../../lib/rpc.js", () => ({
  withRpcFallback: async (fn: (c: unknown) => unknown) => fn({ getAccountInfo: async () => null }),
}));

vi.stubGlobal("fetch", async () => ({
  ok: true,
  json: async () => ({ solana: { usd: 150, usd_24h_change: 1.5 } }),
}));

const SOL_MINT = "So11111111111111111111111111111111111111112";
const PRIVY = "Bearer privy-test-token";

let app: Express;

beforeAll(async () => {
  const { default: v1Router } = await import("./index.js");
  app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use((req: express.Request, _res, next) => {
    (req as unknown as Record<string, unknown>)["log"] = {
      info: () => undefined, warn: () => undefined,
      error: () => undefined, debug: () => undefined,
    };
    next();
  });
  app.use("/api/v1", v1Router);
});

beforeEach(() => {
  stores.apiKeys.splice(0);
  stores.apiUsage.splice(0);
});

async function createKey(name = "k"): Promise<{ id: string; key: string }> {
  const res = await request(app)
    .post("/api/v1/auth/keys")
    .set("Authorization", PRIVY)
    .send({ name });
  expect(res.status).toBe(201);
  return { id: res.body.id as string, key: res.body.key as string };
}

const flush = () => new Promise<void>((r) => setImmediate(r));

describe("usage chart — valid key requests", () => {
  it("totalRequests increases for each authenticated call", async () => {
    const { key } = await createKey();

    for (let i = 0; i < 3; i++) {
      const r = await request(app)
        .get(`/api/v1/price?mint=${SOL_MINT}`)
        .set("Authorization", `Bearer ${key}`);
      expect(r.status).toBe(200);
    }
    await flush();

    const usage = await request(app)
      .get("/api/v1/auth/keys/usage")
      .set("Authorization", PRIVY);

    expect(usage.status).toBe(200);
    expect(usage.body.totalRequests).toBeGreaterThanOrEqual(3);
    expect(usage.body.totalErrors).toBe(0);

    const bucketTotal = (usage.body.points as Array<{ requests: number }>)
      .reduce((s, p) => s + p.requests, 0);
    expect(bucketTotal).toBeGreaterThanOrEqual(3);
  });
});

describe("usage chart — revoked key", () => {
  it("rejects a revoked key with 403 KEY_REVOKED", async () => {
    const { id, key } = await createKey();

    const before = await request(app)
      .get(`/api/v1/price?mint=${SOL_MINT}`)
      .set("Authorization", `Bearer ${key}`);
    expect(before.status).toBe(200);

    await request(app)
      .delete(`/api/v1/auth/keys/${id}`)
      .set("Authorization", PRIVY);

    const after = await request(app)
      .get(`/api/v1/price?mint=${SOL_MINT}`)
      .set("Authorization", `Bearer ${key}`);
    expect(after.status).toBe(403);
    expect(after.body.code).toBe("KEY_REVOKED");
  });

  it("the 403 from a revoked key appears in the error series", async () => {
    const { id, key } = await createKey();

    // One successful call, then revoke, then one rejected call.
    await request(app)
      .get(`/api/v1/price?mint=${SOL_MINT}`)
      .set("Authorization", `Bearer ${key}`);
    await flush();

    await request(app).delete(`/api/v1/auth/keys/${id}`).set("Authorization", PRIVY);

    await request(app)
      .get(`/api/v1/price?mint=${SOL_MINT}`)
      .set("Authorization", `Bearer ${key}`);
    await flush();

    const usage = await request(app)
      .get("/api/v1/auth/keys/usage")
      .set("Authorization", PRIVY);

    expect(usage.status).toBe(200);
    // At least the one revoked-key rejection must appear as an error.
    expect(usage.body.totalErrors).toBeGreaterThanOrEqual(1);
    // Total recorded rows: 1 success + 1 revoked rejection.
    expect(usage.body.totalRequests).toBeGreaterThanOrEqual(2);
  });
});
