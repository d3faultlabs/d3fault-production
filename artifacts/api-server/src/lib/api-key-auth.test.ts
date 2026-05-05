import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

// Mock the db before importing api-key-auth (vi.hoisted ensures variables are
// available inside the hoisted vi.mock factory).
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}));
vi.mock("@workspace/db", () => ({
  db: mockDb,
  apiKeys: { keyHash: "keyHash", id: "id", usageCount: "usageCount" },
  apiUsage: {},
}));
vi.mock("./logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  generateApiKey,
  hashKey,
  requireApiKey,
  type ApiKeyRequest,
} from "./api-key-auth.js";

describe("generateApiKey", () => {
  it("returns a key with the dfk_live_ prefix", () => {
    const { fullKey } = generateApiKey();
    expect(fullKey.startsWith("dfk_live_")).toBe(true);
  });

  it("returns a key with at least 40 characters", () => {
    const { fullKey } = generateApiKey();
    expect(fullKey.length).toBeGreaterThanOrEqual(40);
  });

  it("is unique across many invocations", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const { fullKey } = generateApiKey();
      expect(seen.has(fullKey)).toBe(false);
      seen.add(fullKey);
    }
  });

  it("returns a sha256 keyHash matching the full key", () => {
    const { fullKey, keyHash } = generateApiKey();
    const expected = createHash("sha256").update(fullKey).digest("hex");
    expect(keyHash).toBe(expected);
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a 13-char prefix (dfk_live_ + 4 chars)", () => {
    const { fullKey, keyPrefix } = generateApiKey();
    expect(keyPrefix.length).toBe("dfk_live_".length + 4);
    expect(fullKey.startsWith(keyPrefix)).toBe(true);
  });
});

describe("hashKey", () => {
  it("is deterministic", () => {
    expect(hashKey("dfk_live_abc")).toBe(hashKey("dfk_live_abc"));
  });
  it("differs for different inputs", () => {
    expect(hashKey("dfk_live_a")).not.toBe(hashKey("dfk_live_b"));
  });
});

describe("requireApiKey middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function makeRes() {
    const res: any = {
      statusCode: 200,
      _status: 0,
      _json: undefined as unknown,
      _onFinish: undefined as undefined | (() => void),
    };
    res.status = (s: number) => { res._status = s; return res; };
    res.json = (body: unknown) => { res._json = body; return res; };
    res.on = (evt: string, cb: () => void) => { if (evt === "finish") res._onFinish = cb; };
    return res;
  }

  it("rejects requests with no Authorization header", async () => {
    const req = { headers: {} } as unknown as ApiKeyRequest;
    const res = makeRes();
    const next = vi.fn();
    await requireApiKey(req, res as never, next);
    expect(res._status).toBe(401);
    expect((res._json as { code: string }).code).toBe("UNAUTHORIZED");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects requests with the wrong key prefix", async () => {
    const req = { headers: { authorization: "Bearer not_a_dfk_key" } } as unknown as ApiKeyRequest;
    const res = makeRes();
    const next = vi.fn();
    await requireApiKey(req, res as never, next);
    expect(res._status).toBe(401);
    expect((res._json as { code: string }).code).toBe("INVALID_KEY");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects when the key is not found in the database", async () => {
    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [],
        }),
      }),
    });
    const req = { headers: { authorization: "Bearer dfk_live_xxxxxxxxxxxxxxxx" } } as unknown as ApiKeyRequest;
    const res = makeRes();
    const next = vi.fn();
    await requireApiKey(req, res as never, next);
    expect(res._status).toBe(401);
    expect((res._json as { code: string }).code).toBe("INVALID_KEY");
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects revoked keys with 403", async () => {
    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [{
            id: "k1", userId: "u1", scopes: [], rateLimit: 60,
            keyPrefix: "dfk_live_aaaa", revokedAt: new Date(),
          }],
        }),
      }),
    });
    const req = { headers: { authorization: "Bearer dfk_live_xxxxxxxxxxxxxxxx" } } as unknown as ApiKeyRequest;
    const res = makeRes();
    const next = vi.fn();
    await requireApiKey(req, res as never, next);
    expect(res._status).toBe(403);
    expect((res._json as { code: string }).code).toBe("KEY_REVOKED");
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches req.apiKey and calls next() for valid keys", async () => {
    mockDb.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: async () => [{
            id: "k1", userId: "u1", scopes: ["read"], rateLimit: 60,
            keyPrefix: "dfk_live_aaaa", revokedAt: null,
          }],
        }),
      }),
    });
    mockDb.update.mockReturnValueOnce({
      set: () => ({ where: () => ({ catch: () => undefined }) }),
    });
    const req = { method: "GET", baseUrl: "/api/v1", path: "/program", headers: { authorization: "Bearer dfk_live_xxxxxxxxxxxxxxxx" } } as unknown as ApiKeyRequest;
    const res = makeRes();
    const next = vi.fn();
    await requireApiKey(req, res as never, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.apiKey).toBeDefined();
    expect(req.apiKey?.id).toBe("k1");
    expect(req.apiKey?.userId).toBe("u1");
    expect(req.apiKey?.rateLimit).toBe(60);
  });
});
