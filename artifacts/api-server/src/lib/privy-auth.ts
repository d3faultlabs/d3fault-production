import { PrivyClient } from "@privy-io/server-auth";
import type { Request, Response, NextFunction } from "express";

const PRIVY_APP_ID = process.env["VITE_PRIVY_APP_ID"] ?? process.env["PRIVY_APP_ID"] ?? "";
const PRIVY_APP_SECRET = process.env["PRIVY_APP_SECRET"] ?? "";

let _client: PrivyClient | null = null;

function getPrivyClient(): PrivyClient | null {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) return null;
  if (!_client) {
    _client = new PrivyClient(PRIVY_APP_ID, PRIVY_APP_SECRET);
  }
  return _client;
}

export interface AuthenticatedRequest extends Request {
  privyUserId?: string;
  privyWallet?: string;
}

/**
 * Optional auth middleware — attaches Privy user info if a valid
 * Bearer token is present, but does NOT reject unauthenticated requests.
 * Use requireAuth for protected endpoints.
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
) {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) return next();

  const token = header.slice(7);
  const privy = getPrivyClient();
  if (!privy) return next();

  try {
    const claims = await privy.verifyAuthToken(token);
    req.privyUserId = claims.userId;
  } catch {
    // Invalid token — continue without auth
  }
  next();
}

/**
 * Strict auth middleware — rejects requests without a valid Privy token.
 * Use on endpoints that must be authenticated.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing Authorization header", code: "UNAUTHORIZED" });
    return;
  }

  const token = header.slice(7);
  const privy = getPrivyClient();

  if (!privy) {
    res.status(503).json({ error: "Auth not configured", code: "AUTH_NOT_CONFIGURED" });
    return;
  }

  try {
    const claims = await privy.verifyAuthToken(token);
    req.privyUserId = claims.userId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token", code: "INVALID_TOKEN" });
  }
}

export { getPrivyClient };
