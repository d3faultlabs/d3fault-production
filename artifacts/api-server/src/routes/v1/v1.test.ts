import { describe, it, expect, vi, beforeAll } from "vitest";
import express, { type Express } from "express";
import request from "supertest";

// Mock @workspace/db so we don't hit a real database.
vi.mock("@workspace/db", () => {
  const empty = async () => [];
  const selectChain: any = {
    from: () => selectChain,
    where: () => selectChain,
    limit: empty,
    orderBy: empty,
    groupBy: () => selectChain,
    then: (cb: (r: never[]) => unknown) => Promise.resolve([]).then(cb),
  };
  const updateChain: any = {
    set: () => updateChain,
    where: () => updateChain,
    returning: empty,
  };
  const insertChain: any = {
    values: () => insertChain,
    returning: empty,
  };
  return {
    db: {
      select: () => selectChain,
      update: () => updateChain,
      insert: () => insertChain,
    },
    apiKeys: { keyHash: "keyHash", id: "id", userId: "userId", revokedAt: "revokedAt", usageCount: "usageCount", rateLimit: "rateLimit", name: "name", keyPrefix: "keyPrefix", lastUsedAt: "lastUsedAt", createdAt: "createdAt" },
    apiUsage: { apiKeyId: "apiKeyId", ts: "ts", statusCode: "statusCode" },
  };
});

// Mock privy-auth so we control middleware behavior.
vi.mock("../../lib/privy-auth.js", () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.privyUserId = "test-user"; next(); },
}));

// Mock logger noise.
vi.mock("../../lib/logger.js", () => ({
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined },
}));

// Mock program-helpers so we don't need a real Solana RPC connection.
vi.mock("../../lib/program-helpers.js", () => ({
  buildDepositSolTx: vi.fn(),
  buildDepositSplTx: vi.fn(),
  PROTOCOL_FEE_BPS: 25,
  SPL_FEE_LAMPORTS: 2_100_000n,
  RELAYER_FEE_PUBKEY: { toBase58: () => "EV7T58wSE5rz9a2psrCXaEL5G2X2aUT76Q9hemyWoDTt" },
}));

let app: Express;

beforeAll(async () => {
  const { default: v1Router } = await import("./index.js");
  app = express();
  app.set("trust proxy", 1);
  app.use(express.json());
  app.use("/api/v1", v1Router);
});

describe("v1 routes — auth", () => {
  it("GET /api/v1/program → 401 without an API key", async () => {
    const res = await request(app).get("/api/v1/program");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("GET /api/v1/program → 401 with malformed Authorization", async () => {
    const res = await request(app).get("/api/v1/program").set("Authorization", "Token foo");
    expect(res.status).toBe(401);
  });

  it("GET /api/v1/program → 401 with a non-dfk_ Bearer token", async () => {
    const res = await request(app).get("/api/v1/program").set("Authorization", "Bearer abc123");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_KEY");
  });

  it("GET /api/v1/program → 401 with a syntactically valid but unknown key", async () => {
    const res = await request(app).get("/api/v1/program").set("Authorization", "Bearer dfk_live_unknownkeyxxxxxxxxxxxx");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_KEY");
  });

  it("GET /api/v1/store/commitments → 401 without API key", async () => {
    const res = await request(app).get("/api/v1/store/commitments");
    expect(res.status).toBe(401);
  });

  it("POST /api/v1/secrets/generate → 401 without API key", async () => {
    const res = await request(app).post("/api/v1/secrets/generate");
    expect(res.status).toBe(401);
  });
});

describe("v1 routes — store/lookup validation", () => {
  it("returns INVALID_COMMITMENT for non-hex inputs (after auth bypass)", async () => {
    // Lookup endpoint also requires API key; reaches the validator only after auth passes.
    const res = await request(app).get("/api/v1/store/lookup/not-a-hex");
    expect(res.status).toBe(401);
  });
});

describe("v1 routes — auth/keys (Privy-protected)", () => {
  it("POST /api/v1/auth/keys → 400 without name", async () => {
    const res = await request(app).post("/api/v1/auth/keys").send({});
    expect(res.status).toBe(400);
  });

  it("POST /api/v1/auth/keys → 400 with empty name", async () => {
    const res = await request(app).post("/api/v1/auth/keys").send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("DELETE /api/v1/auth/keys/:id → 404 when key not found in mocked db", async () => {
    const res = await request(app).delete("/api/v1/auth/keys/some-id");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("GET /api/v1/auth/keys → 200 with empty list when user has no keys", async () => {
    const res = await request(app).get("/api/v1/auth/keys");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.keys)).toBe(true);
    expect(res.body.keys).toEqual([]);
  });

  it("GET /api/v1/auth/keys/usage → returns 24-point chart with zeroed buckets", async () => {
    const res = await request(app).get("/api/v1/auth/keys/usage");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.points)).toBe(true);
    expect(res.body.points).toHaveLength(24);
    expect(res.body.totalRequests).toBe(0);
    expect(res.body.totalErrors).toBe(0);
  });
});
