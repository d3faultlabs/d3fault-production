import { Router } from "express";
import { requireAuth, type AuthenticatedRequest } from "../lib/privy-auth";

const router = Router();

/**
 * GET /api/me
 * Returns the authenticated user's Privy ID.
 * Requires a valid Privy Bearer token in the Authorization header.
 */
router.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({
    userId: req.privyUserId,
    authenticated: true,
  });
});

export default router;
