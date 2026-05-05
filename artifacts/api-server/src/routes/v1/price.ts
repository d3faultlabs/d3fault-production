import { Router } from "express";

const router = Router();

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_SENTINEL = "11111111111111111111111111111111";

router.get("/price", async (req, res) => {
  const mint = req.query["mint"] as string | undefined;
  if (!mint) {
    res
      .status(400)
      .json({ error: "mint query param required", code: "MISSING_PARAM" });
    return;
  }
  try {
    if (mint === SOL_MINT || mint === SOL_SENTINEL) {
      const cgRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true",
      );
      if (!cgRes.ok) throw new Error("CoinGecko request failed");
      const data = (await cgRes.json()) as {
        solana: { usd: number; usd_24h_change: number };
      };
      res.json({
        mint,
        symbol: "SOL",
        usdPrice: data.solana.usd,
        change24h: data.solana.usd_24h_change,
      });
      return;
    }
    const dexRes = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
    );
    if (!dexRes.ok) throw new Error("DexScreener request failed");
    const data = (await dexRes.json()) as {
      pairs?: Array<{
        baseToken: { symbol: string };
        priceUsd: string;
        priceChange: { h24: number };
      }>;
    };
    if (!data.pairs || data.pairs.length === 0) {
      res.status(404).json({ error: "Token not found", code: "NOT_FOUND" });
      return;
    }
    const pair = data.pairs[0]!;
    res.json({
      mint,
      symbol: pair.baseToken.symbol,
      usdPrice: parseFloat(pair.priceUsd),
      change24h: pair.priceChange.h24,
    });
  } catch (err) {
    req.log.error({ err, mint }, "Price lookup failed");
    res.status(500).json({ error: "Price lookup failed", code: "PRICE_ERROR" });
  }
});

export default router;
