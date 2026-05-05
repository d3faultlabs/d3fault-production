import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { motion, AnimatePresence, useMotionValue, useTransform, animate as fmAnimate } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignTransaction } from "@privy-io/react-auth/solana";
import {
  RefreshCcw, Send, Activity, ExternalLink,
  Copy, CheckCircle2, ArrowDownUp, Loader2, AlertTriangle,
  Download, RotateCcw, Shield, Plus, Eye, EyeOff,
  Wallet, Key, Trash2, ArrowRight, Link2, Shuffle,
  ChevronDown, LogOut, QrCode, X as XIcon, Lock, Unlock,
} from "lucide-react";
import { GrainOverlay } from "@/components/GrainOverlay";
import { FluidShader } from "@/components/FluidShader";
import { PremiumNavbar, type NavSection } from "@/components/PremiumNavbar";
import { useGetProgramInfo, useGetTokenPrice, useRelayWithdraw } from "@workspace/api-client-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { generateSecret, computeCommitment, parseClaimHash, toHex } from "@workspace/d3fault-shared";
import { connection } from "@/lib/connection";
import { useBrowserWallet, type BrowserWallet } from "@/hooks/useBrowserWallet";
import * as bip39 from "bip39";
import { QRCodeSVG } from "qrcode.react";

// ─── Constants ────────────────────────────────────────────────────────────────
const SOL_MINT  = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface SwapToken { symbol: string; mint: string; decimals: number; name: string; logoURI?: string; }
// Hardcoded logos for known tokens — fall back to Jupiter cache for everything else
const LOGO_SOL  = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png";
const LOGO_USDC = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png";
const LOGO_USDT = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png";
const LOGO_JUP  = "https://static.jup.ag/jup/icon.png";
const LOGO_RAY  = "https://img.raydium.io/icon/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R.png";
const LOGO_BONK = "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I";
const LOGO_MSOL = "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So/logo.png";
const LOGO_WIF  = "https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link";

const SWAP_TOKENS: SwapToken[] = [
  { symbol: "SOL",  mint: "So11111111111111111111111111111111111111112",           decimals: 9, name: "Solana",       logoURI: LOGO_SOL },
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",        decimals: 6, name: "USD Coin",     logoURI: LOGO_USDC },
  { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",        decimals: 6, name: "Tether",       logoURI: LOGO_USDT },
  { symbol: "JUP",  mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",        decimals: 6, name: "Jupiter",      logoURI: LOGO_JUP },
  { symbol: "RAY",  mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",       decimals: 6, name: "Raydium",      logoURI: LOGO_RAY },
  { symbol: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",       decimals: 5, name: "Bonk",         logoURI: LOGO_BONK },
  { symbol: "mSOL", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",        decimals: 9, name: "Marinade SOL", logoURI: LOGO_MSOL },
  { symbol: "WIF",  mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",       decimals: 6, name: "dogwifhat",    logoURI: LOGO_WIF },
];

// SOL sentinel — 32 zero bytes, used as tokenMint for native SOL commitment entries
const SOL_SENTINEL = "11111111111111111111111111111111";
// SPL program addresses
const TOKEN_PROG  = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOC_PROG  = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bRS");
const SYS_PROG    = new PublicKey("11111111111111111111111111111111");
/** Derive an Associated Token Account address */
function getAta(mint: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROG.toBuffer(), mint.toBuffer()],
    ASSOC_PROG
  )[0];
}

// Tokens for private send (SOL uses the sentinel mint, not wrapped SOL)
const PRIVATE_TOKENS: SwapToken[] = [
  { symbol: "SOL",  mint: SOL_SENTINEL,                                        decimals: 9, name: "Solana (native)", logoURI: LOGO_SOL },
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",   decimals: 6, name: "USD Coin",        logoURI: LOGO_USDC },
  { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",   decimals: 6, name: "Tether",          logoURI: LOGO_USDT },
  { symbol: "JUP",  mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",   decimals: 6, name: "Jupiter",         logoURI: LOGO_JUP },
  { symbol: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",  decimals: 5, name: "Bonk",            logoURI: LOGO_BONK },
  { symbol: "mSOL", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",  decimals: 9, name: "Marinade SOL",    logoURI: LOGO_MSOL },
  { symbol: "WIF",  mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm", decimals: 6, name: "dogwifhat",       logoURI: LOGO_WIF },
];

// Protocol fee — 0.25% charged on every private send, goes to the relayer wallet
const PROTOCOL_FEE_BPS = 25;
const RELAYER_FEE_PUBKEY = new PublicKey("EV7T58wSE5rz9a2psrCXaEL5G2X2aUT76Q9hemyWoDTt");

// Resolve token name/symbol/logo from local known lists first, then Jupiter cache
function resolveTokenMeta(mint: string): { symbol: string; name: string; logoURI?: string } {
  const known = [...SWAP_TOKENS, ...PRIVATE_TOKENS].find(t => t.mint === mint);
  if (known) return { symbol: known.symbol, name: known.name, logoURI: known.logoURI };
  const jup = _jupCache.get(mint);
  if (jup) return { symbol: jup.symbol, name: jup.name, logoURI: jup.logoURI };
  return { symbol: mint.slice(0, 4).toUpperCase(), name: mint.slice(0, 12) + "…" };
}

// Jupiter Token API V2 — search by name OR by mint address
// Endpoint: https://lite-api.jup.ag/tokens/v2/search?query=...
// Returns rich data: { id, name, symbol, icon, decimals, usdPrice, mcap, ... }
//
// We keep a Map cache keyed by mint so PortfolioView and TokenLogo can
// resolve metadata for any token they've seen.
const _jupCache: Map<string, SwapToken> = new Map();
const _jupSearchCache: Map<string, SwapToken[]> = new Map();
const _jupInflight: Map<string, Promise<SwapToken[]>> = new Map();

interface JupV2Token { id: string; name: string; symbol: string; icon?: string; decimals: number; }

function searchJupiterTokens(query: string): Promise<SwapToken[]> {
  const q = query.trim();
  if (!q) return Promise.resolve([]);
  const cached = _jupSearchCache.get(q);
  if (cached) return Promise.resolve(cached);
  const inflight = _jupInflight.get(q);
  if (inflight) return inflight;

  const p = fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${encodeURIComponent(q)}`)
    .then(r => r.ok ? r.json() : [])
    .then((arr: JupV2Token[]) => {
      const tokens = (arr || []).map(t => ({
        symbol: t.symbol, mint: t.id, decimals: t.decimals, name: t.name, logoURI: t.icon,
      }));
      _jupSearchCache.set(q, tokens);
      tokens.forEach(t => _jupCache.set(t.mint, t));
      _jupInflight.delete(q);
      return tokens;
    })
    .catch(() => { _jupInflight.delete(q); return []; });
  _jupInflight.set(q, p);
  return p;
}

// Resolve a single mint's metadata (used by PortfolioView for unknown holdings)
function resolveMintAsync(mint: string): Promise<SwapToken | null> {
  if (_jupCache.has(mint)) return Promise.resolve(_jupCache.get(mint) ?? null);
  return searchJupiterTokens(mint).then(arr => arr.find(t => t.mint === mint) ?? null);
}

// ── Jupiter Price API V3 ─────────────────────────────────────────────────────
// Batch endpoint: https://lite-api.jup.ag/price/v3?ids=mint1,mint2
// Returns { "<mint>": { usdPrice, priceChange24h, blockId, decimals } }
// Used by PortfolioView so every SPL token (USDC/USDT/JUP/etc.) gets price + 24h change,
// not just SOL. Bypasses our /api/price (CoinGecko) which is rate-limited.
interface JupPriceRow { usdPrice: number; priceChange24h?: number; blockId?: number; decimals?: number; }
type JupPriceMap = Record<string, JupPriceRow>;

function useJupiterPrices(mints: string[]): { prices: Map<string, JupPriceRow>; loading: boolean } {
  const [prices, setPrices] = useState<Map<string, JupPriceRow>>(new Map());
  const [loading, setLoading] = useState(false);
  // Stable key from sorted mints so dep comparison works
  const key = [...mints].sort().join(",");
  useEffect(() => {
    if (!key) { setPrices(new Map()); return; }
    let cancelled = false;
    setLoading(true);
    fetch(`https://lite-api.jup.ag/price/v3?ids=${encodeURIComponent(key)}`)
      .then(r => r.ok ? r.json() as Promise<JupPriceMap> : ({} as JupPriceMap))
      .then(obj => {
        if (cancelled) return;
        const m = new Map<string, JupPriceRow>();
        for (const [mint, row] of Object.entries(obj || {})) {
          if (row && typeof row.usdPrice === "number") m.set(mint, row);
        }
        setPrices(m);
      })
      .catch(() => { if (!cancelled) setPrices(new Map()); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key]);
  return { prices, loading };
}

// ─── 7-Day Wallet Activity hook ───────────────────────────────────────────────
// Fetches recent signatures and buckets them into the last 7 days for a behaviour summary.
interface ActivityData {
  totalTx: number;
  dailyCounts: number[]; // length 7, oldest → newest
  busiestDay: { label: string; count: number } | null;
  lastActivity: number | null; // unix seconds
  loading: boolean;
}
function useWalletActivity7d(publicKey: PublicKey | null, refresh: number): ActivityData {
  const [data, setData] = useState<ActivityData>({
    totalTx: 0, dailyCounts: [0, 0, 0, 0, 0, 0, 0], busiestDay: null, lastActivity: null, loading: false,
  });
  useEffect(() => {
    if (!publicKey) {
      setData({ totalTx: 0, dailyCounts: [0, 0, 0, 0, 0, 0, 0], busiestDay: null, lastActivity: null, loading: false });
      return;
    }
    let cancelled = false;
    setData(d => ({ ...d, loading: true }));
    (async () => {
      try {
        const sigs = await connection.getSignaturesForAddress(publicKey, { limit: 1000 });
        if (cancelled) return;
        const now = Math.floor(Date.now() / 1000);
        const cutoff = now - 7 * 86400;
        const recent = sigs.filter(s => s.blockTime && s.blockTime >= cutoff);
        const dailyCounts = new Array(7).fill(0) as number[];
        recent.forEach(s => {
          const t = s.blockTime as number;
          const dayIdx = 6 - Math.floor((now - t) / 86400);
          if (dayIdx >= 0 && dayIdx < 7) dailyCounts[dayIdx]++;
        });
        let busiestIdx = 0;
        for (let i = 1; i < 7; i++) if (dailyCounts[i] > dailyCounts[busiestIdx]) busiestIdx = i;
        const busiestDate = new Date((now - (6 - busiestIdx) * 86400) * 1000);
        const dayLabel = busiestDate.toLocaleDateString(undefined, { weekday: "short" });
        setData({
          totalTx: recent.length,
          dailyCounts,
          busiestDay: dailyCounts[busiestIdx] > 0 ? { label: dayLabel, count: dailyCounts[busiestIdx] } : null,
          lastActivity: sigs[0]?.blockTime ?? null,
          loading: false,
        });
      } catch {
        if (!cancelled) setData(d => ({ ...d, loading: false }));
      }
    })();
    return () => { cancelled = true; };
  }, [publicKey, refresh]);
  return data;
}

// ─── TokenLogo component — renders <img>, falls back to colored letter avatar ──
function TokenLogo({ mint, symbol, size = 36 }: { mint: string; symbol: string; size?: number }) {
  const meta = resolveTokenMeta(mint);
  const [errored, setErrored] = useState(false);
  const hue = [...mint].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  if (meta.logoURI && !errored) {
    return (
      <img
        src={meta.logoURI}
        alt={symbol}
        onError={() => setErrored(true)}
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover",
          background: `hsl(${hue}, 30%, 12%)`,
          border: "1px solid rgba(255,255,255,0.10)",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `hsl(${hue}, 55%, 22%)`,
      border: "1px solid rgba(255,255,255,0.10)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.32, fontWeight: 800, color: "rgba(255,255,255,0.85)",
      flexShrink: 0, letterSpacing: "-0.01em", fontFamily: "Space Grotesk",
    }}>
      {symbol.slice(0, 3)}
    </div>
  );
}

// Solana Explorer cluster suffix — empty on mainnet-beta (it's the default).
// Set VITE_SOLANA_NETWORK=mainnet-beta in production; omit or set to "devnet" in dev.
const _NETWORK = (import.meta.env.VITE_SOLANA_NETWORK ?? "devnet") as string;
const EXPLORER_CLUSTER = _NETWORK === "mainnet-beta" ? "" : `?cluster=${_NETWORK}`;
const EXPIRY_PRESETS = [
  { label: "1H",  seconds: 3600 },
  { label: "24H", seconds: 86400 },
  { label: "7D",  seconds: 604800 },
  { label: "30D", seconds: 2592000 },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface TokenBalance { mint: string; symbol: string; balance: number; decimals: number; uiAmount: number; }
interface JupiterQuote { inAmount: string; outAmount: string; priceImpactPct: number; otherAmountThreshold: string; swapMode: string; contextSlot: number; timeTaken: number; routePlan: Array<{ swapInfo: { label: string }; percent: number }>; }

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:       "#060608",
  border:   "rgba(255,255,255,0.08)",
  borderHi: "rgba(255,255,255,0.14)",
  text:     "#ffffff",
  muted:    "rgba(255,255,255,0.45)",
  faint:    "rgba(255,255,255,0.22)",
  dimmed:   "rgba(255,255,255,0.12)",
  surface:  "rgba(255,255,255,0.04)",
  surfaceHi:"rgba(255,255,255,0.07)",
};

const PANEL: React.CSSProperties = {
  background: "linear-gradient(160deg, rgba(28,28,38,0.62) 0%, rgba(14,14,22,0.62) 100%)",
  border: `1px solid rgba(255,255,255,0.10)`,
  backdropFilter: "blur(28px) saturate(180%)",
  WebkitBackdropFilter: "blur(28px) saturate(180%)",
  boxShadow: [
    "0 1px 0 rgba(255,255,255,0.10) inset",
    "0 0 0 1px rgba(255,255,255,0.02) inset",
    "0 12px 48px rgba(0,0,0,0.6)",
    "0 2px 12px rgba(0,0,0,0.45)",
  ].join(", "),
};

const PANEL_SM: React.CSSProperties = {
  background: "rgba(20,20,28,0.60)",
  border: `1px solid rgba(255,255,255,0.10)`,
  backdropFilter: "blur(18px) saturate(170%)",
  WebkitBackdropFilter: "blur(18px) saturate(170%)",
  boxShadow: "0 1px 0 rgba(255,255,255,0.08) inset, 0 6px 24px rgba(0,0,0,0.5)",
};

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  background: "rgba(0,0,0,0.35)",
  border: `1px solid ${C.border}`,
  borderRadius: 10,
  color: C.text,
  fontSize: 14,
  padding: "0 14px",
  height: 44,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset",
  transition: "border-color 0.15s",
};

const BTN_PRIMARY: React.CSSProperties = {
  width: "100%",
  height: 46,
  borderRadius: 11,
  background: "#ffffff",
  color: "#000000",
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.04em",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  boxShadow: "0 0 0 1px rgba(255,255,255,0.4), 0 4px 24px rgba(255,255,255,0.12)",
  transition: "opacity 0.15s, transform 0.1s",
};

const BTN_GHOST: React.CSSProperties = {
  width: "100%",
  height: 40,
  borderRadius: 10,
  background: C.surface,
  color: C.muted,
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.05em",
  border: `1px solid ${C.border}`,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  transition: "color 0.15s, border-color 0.15s",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: C.faint,
};

const DIVIDER = `1px solid ${C.dimmed}`;

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useSolBalance(address: string | null, refresh: number) {
  const [bal, setBal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const fetch_ = useCallback(async () => {
    if (!address) { setBal(null); return; }
    setLoading(true);
    try {
      const lamports = await connection.getBalance(new PublicKey(address));
      setBal(lamports / LAMPORTS_PER_SOL);
    } catch { /* stale */ } finally { setLoading(false); }
  }, [address, refresh]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void fetch_(); }, [fetch_]);
  return { bal, loading, refetch: fetch_ };
}

function useWalletBalances(publicKey: PublicKey | null, refresh: number) {
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [tokens, setTokens] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);

  const fetch_ = useCallback(async () => {
    if (!publicKey) { setSolBalance(null); setTokens([]); return; }
    setLoading(true);
    try {
      const [lamports, ta] = await Promise.all([
        connection.getBalance(publicKey),
        connection.getParsedTokenAccountsByOwner(publicKey, {
          programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
        }),
      ]);
      setSolBalance(lamports / LAMPORTS_PER_SOL);
      setTokens(
        ta.value
          .map((a) => {
            const info = a.account.data.parsed?.info;
            if (!info) return null;
            const amt = info.tokenAmount;
            if (!amt || amt.uiAmount === 0) return null;
            const meta = resolveTokenMeta(info.mint as string);
            return { mint: info.mint as string, symbol: meta.symbol, balance: Number(amt.amount), decimals: amt.decimals as number, uiAmount: amt.uiAmount as number };
          })
          .filter((t): t is TokenBalance => t !== null)
      );
    } catch { /* stale */ } finally { setLoading(false); }
  }, [publicKey, refresh]);

  useEffect(() => { void fetch_(); }, [fetch_]);
  return { solBalance, tokens, loading, refetch: fetch_ };
}

const JUP_QUOTE_API = "https://lite-api.jup.ag/swap/v1/quote";
const JUP_SWAP_API  = "https://lite-api.jup.ag/swap/v1/swap";

function mintDecimals(mint: string): number {
  return SWAP_TOKENS.find(t => t.mint === mint)?.decimals ?? 9;
}

function useJupiterQuote(inputMint: string, outputMint: string, amount: number, inputDecimals = 9, ms = 600) {
  const [quote, setQuote] = useState<JupiterQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!amount || amount <= 0) { setQuote(null); return; }
    const t = setTimeout(async () => {
      setLoading(true); setError(null);
      try {
        const rawAmount = Math.round(amount * Math.pow(10, inputDecimals));
        const res = await fetch(`${JUP_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${rawAmount}&slippageBps=50`);
        if (!res.ok) throw new Error(`Quote fetch failed (${res.status})`);
        setQuote((await res.json()) as JupiterQuote);
      } catch (e) { setError(e instanceof Error ? e.message : "Quote error"); setQuote(null); }
      finally { setLoading(false); }
    }, ms);
    return () => clearTimeout(t);
  }, [inputMint, outputMint, amount, inputDecimals, ms]);

  return { quote, loading, error };
}

// ─── Primitive components ─────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span style={LABEL_STYLE}>{children}</span>;
}

function Card({ children, style, interactive }: { children: React.ReactNode; style?: React.CSSProperties; interactive?: boolean }) {
  return (
    <div
      className={interactive ? "d3-card-interactive" : undefined}
      style={{ ...PANEL, borderRadius: 16, overflow: "hidden", ...style }}
    >
      {children}
    </div>
  );
}

function CardHead({ children, noBorder }: { children: React.ReactNode; noBorder?: boolean }) {
  return (
    <div style={{ padding: "14px 20px", borderBottom: noBorder ? "none" : DIVIDER, display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 52 }}>
      {children}
    </div>
  );
}

function IconBox({ children, size = 32 }: { children: React.ReactNode; size?: number }) {
  return (
    <div style={{ ...PANEL_SM, width: size, height: size, borderRadius: size / 3.5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {children}
    </div>
  );
}

function StatBox({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.25)", border: DIVIDER, borderRadius: 12, padding: "14px 16px" }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 22, fontWeight: 500, color: C.text, letterSpacing: "-0.01em", lineHeight: 1 }}>
        {value}
        {sub && <span style={{ fontSize: 12, color: C.faint, marginLeft: 6, fontWeight: 400 }}>{sub}</span>}
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...PANEL_SM, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: C.muted }}>
      {children}
    </div>
  );
}

function StatusDot({ on = true, color = "rgba(160,255,160,0.8)" }: { on?: boolean; color?: string }) {
  return <span style={{ width: 6, height: 6, borderRadius: "50%", background: on ? color : "rgba(255,255,255,0.3)", display: "inline-block", boxShadow: on ? `0 0 6px ${color}` : "none" }} />;
}

function IconBtn({ onClick, children, 'data-testid': dtid }: { onClick?: () => void; children: React.ReactNode; 'data-testid'?: string }) {
  return (
    <button
      onClick={onClick}
      data-testid={dtid}
      className="d3-icon-btn"
      style={{
        width: 30, height: 30, borderRadius: 8,
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${C.dimmed}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", color: C.faint, flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function CopyBtn({ text, size = 14 }: { text: string; size?: number }) {
  const [copied, setCopied] = useState(false);
  function handle() { void navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <button onClick={handle} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, display: "flex", color: copied ? C.muted : C.dimmed, flexShrink: 0 }}>
      {copied ? <CheckCircle2 style={{ width: size, height: size }} /> : <Copy style={{ width: size, height: size }} />}
    </button>
  );
}

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ─── ModalShell (reused for Export Key + Receive QR) ──────────────────────────
function ModalShell({ open, onClose, title, icon, children }: { open: boolean; onClose: () => void; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] as const }}
          onClick={onClose}
          style={{
            position: "fixed", inset: 0,
            background: "radial-gradient(ellipse at center, rgba(8,8,12,0.72) 0%, rgba(2,2,4,0.92) 100%)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }}
            onClick={e => e.stopPropagation()}
            style={{ position: "relative", width: "100%", maxWidth: 440, fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
          >
            <span aria-hidden className="d3-rotate-vslow" style={{
              position: "absolute", inset: -2, borderRadius: 20,
              background: "conic-gradient(from 0deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 30%, rgba(255,255,255,0.18) 60%, rgba(255,255,255,0) 90%, rgba(255,255,255,0.18))",
              filter: "blur(10px)", opacity: 0.55,
              zIndex: 0, pointerEvents: "none",
            }} />
            <div style={{ ...PANEL, position: "relative", borderRadius: 18, overflow: "hidden", zIndex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 9, background: "linear-gradient(160deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.faint }}>
                    {icon}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>{title}</span>
                </div>
                <motion.button whileHover={{ scale: 1.08, rotate: 90 }} whileTap={{ scale: 0.92 }} onClick={onClose}
                  style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", color: C.faint, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <XIcon style={{ width: 14, height: 14 }} />
                </motion.button>
              </div>
              <div>{children}</div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── ReceiveQRModal ───────────────────────────────────────────────────────────
function ReceiveQRModal({ open, onClose, address, label }: { open: boolean; onClose: () => void; address: string; label: string }) {
  const [copied, setCopied] = useState(false);
  function copy() { void navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <ModalShell open={open} onClose={onClose} title={`Receive — ${label}`} icon={<QrCode style={{ width: 14, height: 14 }} />}>
      <div style={{ padding: "22px 22px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <p style={{ fontSize: 11, color: C.faint, margin: 0, textAlign: "center", lineHeight: 1.6, fontFamily: "monospace", letterSpacing: "0.02em" }}>
          Scan the QR or copy your address. Send only Solana / SPL tokens to this address.
        </p>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.05, ease: [0.22, 1, 0.36, 1] as const }}
          style={{ position: "relative", padding: 4, borderRadius: 18 }}
        >
          <span aria-hidden className="d3-rotate-slow" style={{
            position: "absolute", inset: -1, borderRadius: 19,
            background: "conic-gradient(from 0deg, rgba(255,255,255,0.35), rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.04) 75%, rgba(255,255,255,0.35))",
            filter: "blur(8px)", opacity: 0.55, zIndex: 0,
          }} />
          <div style={{ position: "relative", background: "#fff", padding: 16, borderRadius: 14, boxShadow: "0 4px 24px rgba(0,0,0,0.5)", zIndex: 1 }}>
            <QRCodeSVG value={address} size={208} bgColor="#ffffff" fgColor="#000000" level="M" />
          </div>
        </motion.div>
        <div style={{ width: "100%", background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: C.muted, wordBreak: "break-all", lineHeight: 1.55 }}>{address}</span>
          <button onClick={copy} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", color: copied ? "rgba(120,220,120,0.85)" : C.faint, padding: 4, flexShrink: 0 }}>
            {copied ? <CheckCircle2 style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── ExportKeyModal ───────────────────────────────────────────────────────────
function ExportKeyModal({ open, onClose, exportKey }: { open: boolean; onClose: () => void; exportKey: () => string | null }) {
  const [revealed, setRevealed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const pk = revealed ? exportKey() : null;
  useEffect(() => { if (!open) { setRevealed(false); setConfirmed(false); setCopied(false); } }, [open]);
  function copy() { if (!pk) return; void navigator.clipboard.writeText(pk); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  return (
    <ModalShell open={open} onClose={onClose} title="Export Private Key" icon={<Key style={{ width: 14, height: 14 }} />}>
      <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
        {!revealed ? (
          <>
            <div style={{ display: "flex", gap: 12, padding: "12px 14px", background: "rgba(220,60,60,0.07)", border: "1px solid rgba(220,60,60,0.22)", borderRadius: 10 }}>
              <AlertTriangle style={{ width: 16, height: 16, color: "rgba(220,100,100,0.85)", flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 11, color: "rgba(255,180,180,0.85)", lineHeight: 1.6 }}>
                Anyone with your private key has <strong>full control of your funds</strong>. Never share it. Never paste it into any website, support form, or DM. D3FAULT will never ask for it.
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
              <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ marginTop: 3, accentColor: "#fff", cursor: "pointer" }} />
              <span>I understand the risk. I am alone, on a trusted device, and no one can see my screen.</span>
            </label>
            <motion.button whileHover={{ scale: confirmed ? 1.01 : 1 }} whileTap={{ scale: confirmed ? 0.99 : 1 }}
              onClick={() => setRevealed(true)} disabled={!confirmed}
              className="d3-btn-primary" style={{ ...BTN_PRIMARY, opacity: confirmed ? 1 : 0.4, cursor: confirmed ? "pointer" : "not-allowed" }}>
              <Eye style={{ width: 14, height: 14 }} /> Reveal Private Key
            </motion.button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 11, color: C.faint, margin: 0, fontFamily: "monospace", lineHeight: 1.6 }}>
              Your base58-encoded private key (64 bytes). Import to Phantom, Solflare, or any Solana wallet.
            </p>
            <div style={{ background: "rgba(0,0,0,0.5)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: C.text, wordBreak: "break-all", lineHeight: 1.65, letterSpacing: "0.01em" }}>
              {pk ?? <span style={{ color: C.dimmed, fontStyle: "italic" }}>Key unavailable — try reopening this dialog.</span>}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={copy}
                className="d3-btn-primary" style={{ ...BTN_PRIMARY, flex: 1 }}>
                {copied ? <><CheckCircle2 style={{ width: 14, height: 14 }} /> Copied</> : <><Copy style={{ width: 14, height: 14 }} /> Copy Key</>}
              </motion.button>
              <button onClick={() => setRevealed(false)} className="d3-btn-ghost" style={{ ...BTN_GHOST, width: "auto", padding: "0 18px" }}>
                <EyeOff style={{ width: 13, height: 13 }} /> Hide
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

// ─── Wallet button ────────────────────────────────────────────────────────────
function WalletButton({ large = false }: { large?: boolean }) {
  const { login, logout, authenticated, user } = usePrivy();
  const address = user?.wallet?.address;
  const truncated = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function copyAddress() {
    if (!address) return;
    void navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  if (authenticated && truncated && address) {
    // Premium identicon: 3 colored bars derived from address bytes
    const seed = parseInt(address.slice(0, 6), 16) || 0;
    const dotColors = [
      `hsl(${(seed % 360)}, 70%, 60%)`,
      `hsl(${((seed >> 4) % 360)}, 65%, 55%)`,
      `hsl(${((seed >> 8) % 360)}, 60%, 65%)`,
    ];

    return (
      <div ref={wrapRef} style={{ position: "relative" }}>
        <motion.button
          whileHover={{ scale: 1.015 }} whileTap={{ scale: 0.985 }}
          onClick={() => setOpen(o => !o)}
          style={{
            height: large ? 46 : 38, padding: large ? "0 14px 0 10px" : "0 12px 0 8px",
            borderRadius: large ? 12 : 11, fontSize: large ? 14 : 12, fontWeight: 500,
            color: C.text, display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
            background: open
              ? "linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)"
              : "linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
            border: `1px solid ${open ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.10)"}`,
            boxShadow: open
              ? "0 1px 0 rgba(255,255,255,0.10) inset, 0 6px 24px rgba(0,0,0,0.45)"
              : "0 1px 0 rgba(255,255,255,0.06) inset, 0 2px 8px rgba(0,0,0,0.25)",
            transition: "all 0.15s ease",
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
          }}
          data-testid="button-wallet-trigger"
        >
          {/* Identicon dots */}
          <div style={{ display: "flex", gap: 2, padding: "5px 4px", borderRadius: 6, background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {dotColors.map((c, i) => (
              <span key={i} style={{
                width: 4, height: large ? 14 : 12, borderRadius: 1, background: c,
                boxShadow: `0 0 6px ${c}`, opacity: 0.85,
              }} />
            ))}
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: large ? 13 : 12, fontWeight: 600, letterSpacing: "0.01em", color: C.text }}>
            {truncated}
          </span>
          <ChevronDown style={{
            width: 13, height: 13, color: C.dimmed,
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.18s ease",
          }} />
        </motion.button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1 }}
              exit={{    opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] as const }}
              style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
                minWidth: 280, padding: 6, borderRadius: 14,
                background: "linear-gradient(165deg, rgba(28,28,32,0.98) 0%, rgba(14,14,18,0.98) 100%)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow:
                  "0 1px 0 rgba(255,255,255,0.08) inset, " +
                  "0 24px 48px -12px rgba(0,0,0,0.7), " +
                  "0 8px 24px rgba(0,0,0,0.5)",
                backdropFilter: "blur(16px)",
                fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              }}
              data-testid="dropdown-wallet"
            >
              {/* Header: identicon + label */}
              <div style={{ padding: "12px 12px 10px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ display: "flex", gap: 2, padding: "6px 5px", borderRadius: 7, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {dotColors.map((c, i) => (
                    <span key={i} style={{ width: 5, height: 16, borderRadius: 1, background: c, boxShadow: `0 0 8px ${c}`, opacity: 0.9 }} />
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: C.dimmed, letterSpacing: "0.1em" }}>CONNECTED</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: C.text, letterSpacing: "-0.005em" }}>Solana Wallet</div>
                </div>
              </div>

              {/* Full address row */}
              <div style={{ padding: "10px 12px 8px" }}>
                <div style={{ fontSize: 9, color: C.dimmed, fontWeight: 700, letterSpacing: "0.1em", marginBottom: 6 }}>ADDRESS</div>
                <div style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 10px", borderRadius: 8,
                  background: "rgba(0,0,0,0.45)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <span style={{
                    flex: 1, fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 11, color: C.muted, letterSpacing: "-0.01em",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {address}
                  </span>
                </div>
              </div>

              {/* Action items */}
              <div style={{ padding: "2px 4px 6px", display: "flex", flexDirection: "column", gap: 2 }}>
                <button
                  onClick={copyAddress}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 10px", borderRadius: 8, border: "none",
                    background: "transparent", cursor: "pointer", textAlign: "left",
                    color: C.text, fontSize: 13, fontWeight: 500,
                    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                    letterSpacing: "-0.005em", transition: "background 0.12s ease",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  data-testid="dropdown-copy-address"
                >
                  {copied
                    ? <CheckCircle2 style={{ width: 14, height: 14, color: "rgba(140,230,160,0.95)" }} />
                    : <Copy style={{ width: 14, height: 14, color: C.faint }} />}
                  <span style={{ flex: 1 }}>{copied ? "Copied to clipboard" : "Copy address"}</span>
                </button>

                <a
                  href={`https://solscan.io/account/${address}${EXPLORER_CLUSTER}`}
                  target="_blank" rel="noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 10px", borderRadius: 8, textDecoration: "none",
                    color: C.text, fontSize: 13, fontWeight: 500,
                    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                    letterSpacing: "-0.005em", transition: "background 0.12s ease",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  data-testid="dropdown-view-explorer"
                >
                  <ExternalLink style={{ width: 14, height: 14, color: C.faint }} />
                  <span style={{ flex: 1 }}>View on Explorer</span>
                </a>

                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "4px 6px" }} />

                <button
                  onClick={() => { setOpen(false); void logout(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 10px", borderRadius: 8, border: "none",
                    background: "transparent", cursor: "pointer", textAlign: "left",
                    color: "rgba(255,140,140,0.92)", fontSize: 13, fontWeight: 500,
                    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                    letterSpacing: "-0.005em", transition: "background 0.12s ease",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(220,60,60,0.10)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  data-testid="dropdown-disconnect"
                >
                  <LogOut style={{ width: 14, height: 14 }} />
                  <span style={{ flex: 1 }}>Disconnect</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => void login()}
      style={{ height: large ? 48 : 36, padding: large ? "0 32px" : "0 20px", borderRadius: large ? 13 : 10, fontSize: large ? 15 : 13, fontWeight: 700, letterSpacing: "0.02em", background: "#fff", color: "#000", border: "none", cursor: "pointer", boxShadow: "0 0 0 1px rgba(255,255,255,0.5), 0 4px 20px rgba(255,255,255,0.15)", fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
      Connect Wallet
    </motion.button>
  );
}

const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } } };

// ─── SectionHeader: unified title pattern across all /app views ────────────────
function SectionHeader({
  eyebrow, title, description, icon, right,
}: {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] as const }}
      style={{
        display: "flex", alignItems: "flex-end", justifyContent: "space-between",
        gap: 16, marginBottom: 18, flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
        {icon && (
          <div style={{
            ...PANEL_SM, width: 38, height: 38, borderRadius: 11,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: C.faint, flexShrink: 0,
          }}>
            {icon}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          {eyebrow && (
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", color: C.dimmed, textTransform: "uppercase", marginBottom: 4 }}>
              {eyebrow}
            </div>
          )}
          <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: C.text, lineHeight: 1.1 }}>
            {title}
          </div>
          {description && (
            <div style={{ fontSize: 12, color: C.faint, lineHeight: 1.55, marginTop: 4, maxWidth: 520 }}>
              {description}
            </div>
          )}
        </div>
      </div>
      {right && <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{right}</div>}
    </motion.div>
  );
}

// ─── Skeleton primitives ──────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 12, r = 6, style }: { w?: number | string; h?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="d3-skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
      <td style={{ padding: "15px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Skeleton w={36} h={36} r={10} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Skeleton w={64} h={11} />
            <Skeleton w={92} h={9} />
          </div>
        </div>
      </td>
      {Array.from({ length: cols - 1 }).map((_, i) => (
        <td key={i} style={{ padding: "15px 20px", textAlign: "right" }}>
          <Skeleton w={i === cols - 2 ? 80 : 56} h={11} style={{ marginLeft: "auto" }} />
        </td>
      ))}
    </tr>
  );
}

// ─── CountUp: animates a numeric value smoothly when it changes ───────────────
function CountUpUSD({ value, duration = 0.9, prefix = "$" }: { value: number; duration?: number; prefix?: string }) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, v =>
    `${prefix}${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  );
  useEffect(() => {
    const controls = fmAnimate(mv, value, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [value, duration, mv]);
  return <motion.span>{display}</motion.span>;
}

// ─── ContextChip: replaces "—" / "not-configured" placeholders ────────────────
function ContextChip({ icon, label, tone = "muted" }: { icon?: React.ReactNode; label: string; tone?: "muted" | "loading" | "warn" }) {
  const palette = tone === "loading"
    ? { bg: "rgba(140,180,255,0.06)", border: "rgba(140,180,255,0.18)", color: "rgba(180,200,240,0.75)" }
    : tone === "warn"
    ? { bg: "rgba(220,160,80,0.06)", border: "rgba(220,160,80,0.20)", color: "rgba(240,200,140,0.85)" }
    : { bg: "rgba(255,255,255,0.04)", border: C.border, color: C.dimmed };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "2px 8px", borderRadius: 6,
      background: palette.bg, border: `1px solid ${palette.border}`,
      fontSize: 10, fontWeight: 600, letterSpacing: "0.04em",
      color: palette.color, fontFamily: "'JetBrains Mono', monospace",
    }}>
      {icon}{label}
    </span>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const VALID_SECTIONS: NavSection[] = ["wallet", "swap", "send", "receive", "portfolio"];

export default function AppDex() {
  const { authenticated, user } = usePrivy();
  const publicKey = user?.wallet?.address ? new PublicKey(user.wallet.address) : null;
  const { data: programInfo } = useGetProgramInfo();
  const [balanceRefresh, setBalanceRefresh] = useState(0);
  const [, params] = useRoute<{ section?: string }>("/app/:section");
  const [, setLocation] = useLocation();
  const sectionParam = params?.section as NavSection | undefined;
  const activeTab: NavSection = sectionParam && VALID_SECTIONS.includes(sectionParam) ? sectionParam : "wallet";
  const [presetSendSource, setPresetSendSource] = useState<string | null>(null);

  function navigateToSend(sourceAddress: string) {
    setPresetSendSource(sourceAddress);
    setLocation("/app/send");
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, display: "flex", flexDirection: "column", fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
      <GrainOverlay />

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.55 }}>
          <FluidShader strength={0.18} interactive={false} />
        </div>
        <div style={{ position: "absolute", top: -120, left: "50%", transform: "translateX(-50%)", width: 800, height: 400, background: "radial-gradient(ellipse, rgba(255,255,255,0.028) 0%, transparent 70%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: -200, right: -100, width: 600, height: 600, background: "radial-gradient(ellipse, rgba(100,80,255,0.04) 0%, transparent 70%)", borderRadius: "50%" }} />
      </div>

      <header style={{ position: "relative", zIndex: 50, height: 58, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", borderBottom: DIVIDER, background: "rgba(6,6,8,0.98)", boxShadow: "0 1px 0 rgba(255,255,255,0.06) inset" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
          <motion.div
            whileHover={{ rotate: -4, scale: 1.05 }}
            transition={{ type: "spring", stiffness: 350, damping: 18 }}
            style={{
              width: 30, height: 30, borderRadius: 8, overflow: "hidden",
              filter: "drop-shadow(0 0 12px rgba(255,255,255,0.18))",
              flexShrink: 0,
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}logo.png`}
              alt="D3FAULT"
              style={{ width: "140%", height: "140%", objectFit: "cover", marginLeft: "-20%", marginTop: "-20%" }}
            />
          </motion.div>
          <span style={{ fontWeight: 700, fontSize: 15, color: C.text, letterSpacing: "-0.025em" }}>D3FAULT</span>
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {programInfo
            ? <Pill><StatusDot />{programInfo.network.toUpperCase()}</Pill>
            : <Pill><StatusDot color="rgba(220,180,80,0.85)" />CONNECTING</Pill>}
          <WalletButton />
        </div>
      </header>

      <main style={{ position: "relative", zIndex: 10, flex: 1, width: "100%", maxWidth: 1020, margin: "0 auto", padding: "36px 24px 48px", display: "flex", flexDirection: "column" }}>
        {!authenticated ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
            style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "62vh", gap: 22 }}>
            <div style={{ ...PANEL, width: 72, height: 72, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <LockIcon style={{ width: 30, height: 30, color: C.faint }} />
            </div>
            <div style={{ textAlign: "center" }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 10px", letterSpacing: "-0.02em" }}>Connect your wallet</h2>
              <p style={{ fontSize: 14, color: C.faint, maxWidth: 300, lineHeight: 1.65, fontWeight: 400, margin: 0 }}>
                Connect a Solana wallet to access the D3FAULT terminal.
              </p>
            </div>
            <WalletButton large />
          </motion.div>
        ) : (
          <motion.div>
            <PremiumNavbar active={activeTab} />
            <div style={{ width: "100%", position: "relative" }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  style={{ width: "100%" }}
                >
                  {activeTab === "wallet"    && <WalletView publicKey={publicKey} refresh={balanceRefresh} onRefresh={() => setBalanceRefresh(n => n + 1)} onNavigateSend={navigateToSend} />}
                  {activeTab === "swap"      && <PrivateSwapView publicKey={publicKey} />}
                  {activeTab === "send"      && <TransferView publicKey={publicKey} onDeposited={() => setBalanceRefresh(n => n + 1)} presetSource={presetSendSource} clearPreset={() => setPresetSendSource(null)} />}
                  {activeTab === "receive"   && <ReceiveView publicKey={publicKey} />}
                  {activeTab === "portfolio" && <PortfolioView publicKey={publicKey} refresh={balanceRefresh} />}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

// ─── WalletCard (individual wallet display) ───────────────────────────────────
function WalletCard({
  label, badge, address, sol, usd, onRefresh, loading, accent, action, onRemove,
  onSend, onReceive, onExport, onLock,
}: {
  label: string; badge?: React.ReactNode; address: string;
  sol: number | null; usd: string | null; onRefresh?: () => void;
  loading?: boolean; accent?: string; action?: React.ReactNode; onRemove?: () => void;
  onSend?: () => void; onReceive?: () => void; onExport?: () => void; onLock?: () => void;
}) {
  return (
    <Card>
      <CardHead>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusDot color={accent ?? "rgba(160,255,160,0.8)"} />
          <FieldLabel>{label}</FieldLabel>
          {badge}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onLock && (
            <button onClick={onLock} title="Lock wallet" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, display: "flex", color: C.dimmed }}>
              <Lock style={{ width: 13, height: 13 }} />
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove} title="Remove wallet" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 2, display: "flex", color: C.dimmed }}>
              <Trash2 style={{ width: 13, height: 13 }} />
            </button>
          )}
          {onRefresh && (
            <IconBtn onClick={onRefresh} data-testid="button-refresh-balances">
              {loading ? <Loader2 style={{ width: 13, height: 13, animation: "spin 1s linear infinite" }} /> : <RefreshCcw style={{ width: 13, height: 13 }} />}
            </IconBtn>
          )}
        </div>
      </CardHead>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Address — full for transparency */}
        <div style={{ background: "rgba(0,0,0,0.35)", border: DIVIDER, borderRadius: 10, padding: "10px 12px", boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: C.muted, wordBreak: "break-all", lineHeight: 1.7, flex: 1 }}>{address}</span>
            <div style={{ display: "flex", gap: 4, flexShrink: 0, paddingTop: 1 }}>
              <CopyBtn text={address} />
              <a href={`https://solscan.io/account/${address}${EXPLORER_CLUSTER}`} target="_blank" rel="noreferrer" style={{ display: "flex", color: C.dimmed }}>
                <ExternalLink style={{ width: 13, height: 13 }} />
              </a>
            </div>
          </div>
        </div>
        {/* Balances */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <StatBox label="SOL Balance" value={sol !== null ? sol.toFixed(4) : <Skeleton w={64} h={20} />} sub="SOL" />
          <StatBox label="USD Value" value={usd ? `$${usd}` : <Skeleton w={72} h={20} />} sub="USD" />
        </div>
        {/* Quick actions */}
        {(onSend || onReceive || onExport) && (
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${[onSend, onReceive, onExport].filter(Boolean).length}, 1fr)`, gap: 8 }}>
            {onSend && (
              <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={onSend}
                style={{ ...PANEL_SM, height: 64, borderRadius: 11, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, color: C.muted, fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
                <Send style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Send</span>
              </motion.button>
            )}
            {onReceive && (
              <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={onReceive}
                style={{ ...PANEL_SM, height: 64, borderRadius: 11, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, color: C.muted, fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
                <QrCode style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Receive</span>
              </motion.button>
            )}
            {onExport && (
              <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} onClick={onExport}
                style={{ ...PANEL_SM, height: 64, borderRadius: 11, border: `1px solid ${C.border}`, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, color: C.muted, fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
                <Key style={{ width: 15, height: 15 }} />
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Export Key</span>
              </motion.button>
            )}
          </div>
        )}
        {action}
      </div>
    </Card>
  );
}

// ─── PasswordField ────────────────────────────────────────────────────────────
function PasswordField({ value, onChange, placeholder = "Set a wallet password", label = "Wallet Password" }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ position: "relative" }}>
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...INPUT_STYLE, paddingRight: 42, fontFamily: "monospace", letterSpacing: "0.06em" }}
          autoComplete="new-password"
        />
        <button onClick={() => setShow(s => !s)} type="button"
          style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", cursor: "pointer", color: C.dimmed, display: "flex" }}>
          {show ? <EyeOff style={{ width: 14, height: 14 }} /> : <Eye style={{ width: 14, height: 14 }} />}
        </button>
      </div>
      <p style={{ fontSize: 9, color: C.dimmed, margin: 0, fontFamily: "monospace", lineHeight: 1.5 }}>
        Used to encrypt your key locally. D3FAULT never sees this password.
      </p>
    </div>
  );
}

// ─── CreateWalletPanel ────────────────────────────────────────────────────────
function CreateWalletPanel({ onCreate, onCancel }: { onCreate: () => void; onCancel: () => void }) {
  const { createWallet } = useBrowserWallet();
  const [step, setStep]         = useState<1 | 2 | 3>(1);
  const [mnemonic, setMnemonic] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [reveal, setReveal]     = useState(false);
  const [password, setPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [err, setErr]           = useState<string | null>(null);

  function generate() {
    const phrase = bip39.generateMnemonic(128); // in-memory only
    setMnemonic(phrase.split(" "));
    setStep(2);
  }

  async function finish() {
    if (!password) { setErr("Please set a password to encrypt your wallet."); return; }
    setCreating(true); setErr(null);
    try {
      await createWallet(mnemonic.join(" "), password);
      onCreate();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed to create wallet"); }
    finally { setCreating(false); }
  }

  return (
    <Card>
      <CardHead>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Plus style={{ width: 13, height: 13, color: C.faint }} />
          <FieldLabel>Create Browser Wallet</FieldLabel>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[1,2,3].map(n => <div key={n} style={{ width: n === step ? 14 : 5, height: 5, borderRadius: 3, background: n === step ? C.muted : n < step ? "rgba(120,220,120,0.5)" : C.dimmed, transition: "all 0.25s" }} />)}
          </div>
          <button onClick={onCancel} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.dimmed, fontSize: 11, fontWeight: 600 }}>✕</button>
        </div>
      </CardHead>
      <div style={{ padding: 20, overflowY: "auto", maxHeight: 520 }}>
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="gen" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "rgba(255,200,0,0.05)", border: "1px solid rgba(255,200,0,0.14)", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 8 }}>
                <AlertTriangle style={{ width: 13, height: 13, color: "rgba(255,200,0,0.6)", flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 11, color: "rgba(255,200,0,0.55)", lineHeight: 1.65 }}>
                  Your seed phrase is the only way to recover this wallet. D3FAULT never transmits or stores it. Write it down offline.
                </p>
              </div>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={generate} className="d3-btn-primary" style={BTN_PRIMARY}>
                Generate Seed Phrase
              </motion.button>
            </motion.div>
          )}
          {step === 2 && (
            <motion.div key="reveal" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <FieldLabel>Seed Phrase (12 words)</FieldLabel>
                <button onClick={() => setReveal(r => !r)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, color: C.faint, fontSize: 11, fontWeight: 600 }}>
                  {reveal ? <EyeOff style={{ width: 12, height: 12 }} /> : <Eye style={{ width: 12, height: 12 }} />}
                  {reveal ? "Hide" : "Reveal"}
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5 }}>
                {mnemonic.map((w, i) => (
                  <div key={i} style={{ background: "rgba(0,0,0,0.4)", border: DIVIDER, borderRadius: 8, padding: "7px 9px", display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ fontSize: 9, fontWeight: 600, color: C.dimmed, minWidth: 12 }}>{i + 1}</span>
                    <span style={{ fontSize: 11, fontFamily: "monospace", color: C.muted, filter: reveal ? "none" : "blur(3px)", userSelect: reveal ? "text" : "none", transition: "filter 0.2s" }}>{w}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => void navigator.clipboard.writeText(mnemonic.join(" "))}
                style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 11, color: C.faint, display: "flex", alignItems: "center", gap: 5, alignSelf: "flex-end" }}>
                <Copy style={{ width: 11, height: 11 }} /> Copy all
              </button>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} style={{ marginTop: 2, accentColor: "#fff", width: 14, height: 14, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: C.faint, lineHeight: 1.6 }}>I have saved my seed phrase offline and understand it cannot be recovered if lost.</span>
              </label>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => setStep(3)}
                disabled={!confirmed} className="d3-btn-primary" style={{ ...BTN_PRIMARY, opacity: !confirmed ? 0.38 : 1 }}>
                Next — Set Password
              </motion.button>
            </motion.div>
          )}
          {step === 3 && (
            <motion.div key="password" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <PasswordField value={password} onChange={setPassword} />
              {err && <p style={{ fontSize: 11, color: "rgba(220,100,100,0.7)", margin: 0, fontFamily: "monospace" }}>{err}</p>}
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => void finish()}
                disabled={!password || creating} className="d3-btn-primary" style={{ ...BTN_PRIMARY, opacity: (!password || creating) ? 0.38 : 1 }}>
                {creating ? <><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />Encrypting…</> : "Create Wallet"}
              </motion.button>
              <button onClick={() => setStep(2)} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 11, color: C.dimmed, textAlign: "center" }}>← Back</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

// ─── ImportWalletPanel ────────────────────────────────────────────────────────
function ImportWalletPanel({ onImport, onCancel }: { onImport: () => void; onCancel: () => void }) {
  const { importFromMnemonic, importFromPrivateKey } = useBrowserWallet();
  const [mode, setMode]     = useState<"phrase" | "key">("phrase");
  const [input, setInput]   = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]       = useState<string | null>(null);
  const [busy, setBusy]     = useState(false);

  async function handleImport() {
    setErr(null); setBusy(true);
    try {
      if (!password) throw new Error("A password is required to encrypt your wallet.");
      if (mode === "phrase") await importFromMnemonic(input, password);
      else await importFromPrivateKey(input, password);
      onImport();
    } catch (e) { setErr(e instanceof Error ? e.message : "Import failed"); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHead>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Key style={{ width: 13, height: 13, color: C.faint }} />
          <FieldLabel>Import Wallet</FieldLabel>
        </div>
        <button onClick={onCancel} style={{ background: "transparent", border: "none", cursor: "pointer", color: C.dimmed, fontSize: 11, fontWeight: 600 }}>✕</button>
      </CardHead>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {(["phrase", "key"] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setInput(""); setErr(null); }}
              style={{ height: 36, borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em", transition: "all 0.15s", border: "1px solid",
                ...(mode === m
                  ? { background: "#fff", color: "#000", borderColor: "#fff", boxShadow: "0 0 0 1px rgba(255,255,255,0.3)" }
                  : { background: "transparent", color: C.faint, borderColor: C.border })
              }}>
              {m === "phrase" ? "Seed Phrase" : "Private Key"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <FieldLabel>{mode === "phrase" ? "12-word seed phrase" : "Base58 or hex (64-byte)"}</FieldLabel>
          <textarea value={input} onChange={e => { setInput(e.target.value); setErr(null); }}
            placeholder={mode === "phrase" ? "word1 word2 word3 … word12" : "Paste private key"}
            style={{ ...INPUT_STYLE, height: mode === "phrase" ? 72 : 48, padding: "10px 14px", resize: "none", fontFamily: "monospace", fontSize: 12, lineHeight: 1.6 }} />
        </div>
        <PasswordField value={password} onChange={setPassword} />
        {err && <p style={{ fontSize: 11, color: "rgba(220,100,100,0.7)", margin: 0, fontFamily: "monospace" }}>{err}</p>}
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => void handleImport()}
          disabled={!input.trim() || !password || busy}
          className="d3-btn-primary" style={{ ...BTN_PRIMARY, opacity: (!input.trim() || !password || busy) ? 0.38 : 1 }}>
          {busy ? <><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />Importing…</> : "Import & Encrypt Wallet"}
        </motion.button>
      </div>
    </Card>
  );
}

// ─── UnlockWalletPanel ────────────────────────────────────────────────────────
function UnlockWalletPanel({ publicKey, onUnlock, onRemove }: { publicKey: string; onUnlock: () => void; onRemove: () => void }) {
  const { unlockWallet } = useBrowserWallet();
  const [password, setPassword] = useState("");
  const [err, setErr]           = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);

  async function handleUnlock() {
    setErr(null); setBusy(true);
    try {
      await unlockWallet(password);
      onUnlock();
    } catch (e) { setErr(e instanceof Error ? e.message : "Unlock failed"); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHead>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <StatusDot color="rgba(140,180,255,0.8)" />
          <FieldLabel>Browser Wallet — Locked</FieldLabel>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: C.dimmed, background: "rgba(255,255,255,0.06)", padding: "2px 7px", borderRadius: 4 }}>LOCAL</span>
      </CardHead>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "rgba(0,0,0,0.35)", border: DIVIDER, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ fontFamily: "monospace", fontSize: 11, color: C.dimmed, wordBreak: "break-all", lineHeight: 1.7, flex: 1 }}>{publicKey}</span>
            <div style={{ flexShrink: 0, paddingTop: 1 }}>
              <CopyBtn text={publicKey} />
            </div>
          </div>
        </div>
        <PasswordField value={password} onChange={setPassword} placeholder="Enter wallet password" label="Password" />
        {err && (
          <div style={{ background: "rgba(220,60,60,0.12)", border: "1px solid rgba(220,80,80,0.35)", borderRadius: 8, padding: "8px 12px" }}>
            <p style={{ fontSize: 12, color: "rgba(255,120,120,1)", margin: 0, fontFamily: "monospace", fontWeight: 600 }}>{err}</p>
          </div>
        )}
        <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => void handleUnlock()}
          disabled={!password || busy} className="d3-btn-primary" style={{ ...BTN_PRIMARY, opacity: (!password || busy) ? 0.38 : 1 }}>
          {busy ? <><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} />Unlocking…</> : "Unlock Wallet"}
        </motion.button>
        <button onClick={onRemove} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 11, color: "rgba(220,100,100,0.5)", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          <Trash2 style={{ width: 12, height: 12 }} /> Remove wallet
        </button>
      </div>
    </Card>
  );
}

// ─── AddWalletPlaceholder ─────────────────────────────────────────────────────
function AddWalletPlaceholder({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  return (
    <div style={{ position: "relative", borderRadius: 16, padding: 1, overflow: "hidden", minHeight: 240 }}>
      <div className="d3-dashed-border" style={{ position: "absolute", inset: 0, borderRadius: 16, pointerEvents: "none" }} />
      <div style={{ ...PANEL, position: "relative", borderRadius: 15, border: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "32px 24px", minHeight: 238, boxShadow: "none", background: "linear-gradient(160deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.005) 100%)" }}>
      <div style={{ textAlign: "center" }}>
        <motion.div
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ ...PANEL_SM, width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px", boxShadow: "0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)" }}
        >
          <Wallet style={{ width: 20, height: 20, color: C.muted }} />
        </motion.div>
        <p style={{ fontSize: 13, fontWeight: 600, color: C.faint, margin: "0 0 4px" }}>Browser Wallet</p>
        <p style={{ fontSize: 11, color: C.dimmed, margin: 0, lineHeight: 1.6 }}>Create or import a Solana wallet<br/>stored locally in your browser</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onAdd}
          className="d3-btn-primary" style={{ ...BTN_PRIMARY, height: 42 }}>
          <Plus style={{ width: 14, height: 14 }} />Create New Wallet
        </motion.button>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onImport}
          className="d3-btn-ghost" style={{ ...BTN_GHOST, height: 42 }}>
          <Key style={{ width: 13, height: 13 }} />Import Existing
        </motion.button>
      </div>
      </div>
    </div>
  );
}

// ─── WalletView ───────────────────────────────────────────────────────────────
function WalletView({ publicKey, refresh, onRefresh, onNavigateSend }: { publicKey: PublicKey | null; refresh: number; onRefresh: () => void; onNavigateSend?: (sourceAddress: string) => void }) {
  const { solBalance, tokens, loading } = useWalletBalances(publicKey, refresh);
  const { data: solPrice } = useGetTokenPrice({ mint: SOL_MINT });
  const { wallet: browserWallet, hasWallet, locked: bwLocked, loaded: bwLoaded, publicKeyStored, removeWallet, exportPrivateKey, lockWallet } = useBrowserWallet();
  const [bwRefresh, setBwRefresh] = useState(0);
  const { bal: bwSol, loading: bwLoading, refetch: bwRefetch } = useSolBalance(browserWallet?.publicKey ?? null, bwRefresh);

  const [walletAction, setWalletAction] = useState<null | "create" | "import">(null);
  const [receiveModal, setReceiveModal] = useState<{ address: string; label: string } | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const solUsd = solBalance !== null && solPrice?.usdPrice ? (solBalance * solPrice.usdPrice).toFixed(2) : null;
  const bwUsd  = bwSol !== null && solPrice?.usdPrice ? (bwSol * solPrice.usdPrice).toFixed(2) : null;

  function handleRemoveBrowserWallet() {
    if (!confirm("Remove browser wallet? Make sure you have the seed phrase saved.")) return;
    removeWallet();
  }

  return (
    <motion.div>
      {/* Modals */}
      {receiveModal && (
        <ReceiveQRModal open={!!receiveModal} onClose={() => setReceiveModal(null)} address={receiveModal.address} label={receiveModal.label} />
      )}
      <ExportKeyModal open={exportOpen} onClose={() => setExportOpen(false)} exportKey={exportPrivateKey} />

      <SectionHeader
        eyebrow="Wallets"
        title="Your wallets"
        description="Connected wallets and a locally-encrypted browser wallet for everyday on-chain moves."
        icon={<Wallet style={{ width: 16, height: 16 }} />}
        right={<ContextChip icon={<StatusDot />} label={loading ? "SYNCING" : "LIVE"} tone={loading ? "loading" : "muted"} />}
      />

      {/* Wallet cards row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        {/* Connected wallet (Privy) */}
        <WalletCard
          label="Connected Wallet"
          badge={<span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: C.dimmed, background: "rgba(255,255,255,0.06)", padding: "2px 7px", borderRadius: 4 }}>PRIVY</span>}
          address={publicKey?.toBase58() ?? ""}
          sol={solBalance}
          usd={solUsd}
          onRefresh={onRefresh}
          loading={loading}
          accent="rgba(160,255,160,0.8)"
          onSend={publicKey && onNavigateSend ? () => onNavigateSend(publicKey.toBase58()) : undefined}
          onReceive={publicKey ? () => setReceiveModal({ address: publicKey.toBase58(), label: "Connected Wallet" }) : undefined}
        />

        {/* Browser wallet slot */}
        <AnimatePresence mode="wait">
          {!bwLoaded ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ ...PANEL, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
              <Loader2 style={{ width: 18, height: 18, color: C.dimmed, animation: "spin 1s linear infinite" }} />
            </motion.div>
          ) : bwLocked && publicKeyStored ? (
            <motion.div key="locked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <UnlockWalletPanel
                publicKey={publicKeyStored}
                onUnlock={() => setBwRefresh(n => n + 1)}
                onRemove={handleRemoveBrowserWallet}
              />
            </motion.div>
          ) : hasWallet && browserWallet ? (
            <motion.div key="bw-card" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}>
              <WalletCard
                label="Browser Wallet"
                badge={<span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: C.dimmed, background: "rgba(255,255,255,0.06)", padding: "2px 7px", borderRadius: 4 }}>LOCAL</span>}
                address={browserWallet.publicKey}
                sol={bwSol}
                usd={bwUsd}
                onRefresh={bwRefetch}
                loading={bwLoading}
                accent="rgba(140,180,255,0.8)"
                onRemove={handleRemoveBrowserWallet}
                onLock={lockWallet}
                onSend={onNavigateSend ? () => onNavigateSend(browserWallet.publicKey) : undefined}
                onReceive={() => setReceiveModal({ address: browserWallet.publicKey, label: "Browser Wallet" })}
                onExport={() => setExportOpen(true)}
              />
            </motion.div>
          ) : walletAction === "create" ? (
            <motion.div key="create" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <CreateWalletPanel
                onCreate={() => { setWalletAction(null); setBwRefresh(n => n + 1); }}
                onCancel={() => setWalletAction(null)}
              />
            </motion.div>
          ) : walletAction === "import" ? (
            <motion.div key="import" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <ImportWalletPanel
                onImport={() => { setWalletAction(null); setBwRefresh(n => n + 1); }}
                onCancel={() => setWalletAction(null)}
              />
            </motion.div>
          ) : (
            <motion.div key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AddWalletPlaceholder onAdd={() => setWalletAction("create")} onImport={() => setWalletAction("import")} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Token accounts */}
      <Card style={{ marginBottom: 16 }}>
        <CardHead>
          <FieldLabel>Token Accounts</FieldLabel>
          {loading
            ? <ContextChip icon={<Loader2 style={{ width: 9, height: 9, animation: "spin 1s linear infinite" }} />} label="SCANNING" tone="loading" />
            : <ContextChip label={`${tokens.length} ${tokens.length === 1 ? "ACCOUNT" : "ACCOUNTS"}`} />}
        </CardHead>
        <div>
          {tokens.length === 0 ? (
            loading ? (
              <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                      <Skeleton w={64} h={11} />
                      <Skeleton w={120} h={9} />
                    </div>
                    <Skeleton w={70} h={11} />
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ margin: "20px", padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, color: C.dimmed, fontSize: 12, border: `1px dashed ${C.dimmed}`, borderRadius: 10 }}>
                <div style={{ ...PANEL_SM, width: 40, height: 40, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Wallet style={{ width: 16, height: 16, color: C.faint }} />
                </div>
                <div style={{ textAlign: "center", lineHeight: 1.55 }}>
                  <div style={{ color: C.muted, fontWeight: 600, fontSize: 12 }}>No SPL token accounts</div>
                  <div style={{ color: C.dimmed, marginTop: 3, fontSize: 11 }}>Receive any SPL token to open your first account.</div>
                </div>
              </div>
            )
          ) : (
            tokens.map((t) => (
              <div key={t.mint} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px", borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.muted }}>{t.symbol}</div>
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dimmed, marginTop: 2 }}>{t.mint.slice(0, 14)}…</div>
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: C.faint }}>{t.uiAmount.toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </Card>

      <ReclaimPanel publicKey={publicKey} />
    </motion.div>
  );
}

// ─── ReclaimPanel ─────────────────────────────────────────────────────────────
function ReclaimPanel({ publicKey }: { publicKey: PublicKey | null }) {
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const [secretHex, setSecretHex] = useState("");
  const [reclaiming, setReclaiming] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [commitPrev, setCommitPrev] = useState("");

  useEffect(() => {
    if (!/^[0-9a-f]{64}$/i.test(secretHex)) { setCommitPrev(""); return; }
    void computeCommitment(new Uint8Array(secretHex.match(/.{2}/g)!.map(b => parseInt(b, 16)))).then(c => {
      setCommitPrev(Array.from(c).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16) + "…");
    });
  }, [secretHex]);

  async function handleReclaim() {
    if (!publicKey || !/^[0-9a-f]{64}$/i.test(secretHex)) return;
    setReclaiming(true); setErr(null); setTxSig(null);
    try {
      const { PLACEHOLDER_PROGRAM_ID } = await import("@workspace/d3fault-shared");
      const { Transaction, SystemProgram, PublicKey: SPK, TransactionInstruction } = await import("@solana/web3.js");
      const commitment = await computeCommitment(new Uint8Array(secretHex.match(/.{2}/g)!.map(b => parseInt(b, 16))));
      const pid   = new SPK(PLACEHOLDER_PROGRAM_ID);
      const [csPda] = SPK.findProgramAddressSync([Buffer.from("commitment_store")], pid);
      // disc = sha256("global:reclaim_sol")[0:8]
      const disc = new Uint8Array([0xd2, 0x27, 0x6c, 0xf1, 0xb0, 0x7a, 0x54, 0xe8]);
      // data = disc(8) | commitment(32) = 40 bytes
      const data = new Uint8Array(40); data.set(disc, 0); data.set(commitment, 8);
      // IDL accounts: [commitmentStore (writable), depositor (writable, signer), systemProgram]
      const ix = new TransactionInstruction({
        programId: pid,
        keys: [
          { pubkey: csPda,                   isSigner: false, isWritable: true  },
          { pubkey: publicKey,               isSigner: true,  isWritable: true  },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(data),
      });
      const tx = new Transaction().add(ix);
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash; tx.feePayer = publicKey;
      // Use the wallet whose address matches publicKey (not always wallets[0])
      const w = wallets.find(wl => wl.address === publicKey.toBase58()) ?? wallets[0];
      if (!w) throw new Error("No wallet");
      const { signedTransaction } = await signTransaction({ transaction: tx.serialize({ requireAllSignatures: false }), wallet: w });
      const sig = await connection.sendRawTransaction(signedTransaction);
      await connection.confirmTransaction(sig, "confirmed");
      setTxSig(sig);
    } catch (e) { setErr(e instanceof Error ? e.message : "Reclaim failed"); }
    finally { setReclaiming(false); }
  }

  const validHex = /^[0-9a-f]{64}$/i.test(secretHex);

  return (
    <Card>
      <CardHead>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.02))", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.faint }}>
            <RotateCcw style={{ width: 13, height: 13 }} />
          </div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", color: C.dimmed, textTransform: "uppercase" }}>Recovery</div>
            <FieldLabel>Reclaim Expired Transfer</FieldLabel>
          </div>
        </div>
        <ContextChip label="ON-CHAIN" />
      </CardHead>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 12, color: C.faint, lineHeight: 1.7, margin: 0, fontWeight: 400 }}>
          Deposited funds whose claim link was never used can be returned to your wallet by entering the original secret below.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <FieldLabel>Secret Hex (64 characters)</FieldLabel>
          <input
            style={{ ...INPUT_STYLE, fontFamily: "monospace", fontSize: 12, letterSpacing: "0.04em" }}
            placeholder="0000000000000000000000000000000000000000000000000000000000000000"
            value={secretHex}
            onChange={e => setSecretHex(e.target.value.toLowerCase())}
            data-testid="input-reclaim-secret"
          />
          {commitPrev && (
            <div style={{ fontFamily: "monospace", fontSize: 10, color: C.dimmed }}>
              commitment: <span style={{ color: C.faint }}>{commitPrev}</span>
            </div>
          )}
        </div>

        {txSig ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "rgba(120,220,120,0.8)" }}>
              <CheckCircle2 style={{ width: 14, height: 14 }} /> Reclaim successful
            </div>
            <a href={`https://solscan.io/tx/${txSig}${EXPLORER_CLUSTER}`} target="_blank" rel="noreferrer"
              style={{ fontFamily: "monospace", fontSize: 10, color: C.faint, display: "flex", alignItems: "center", gap: 5 }}>
              <ExternalLink style={{ width: 11, height: 11 }} /> View on Explorer
            </a>
          </div>
        ) : (
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => void handleReclaim()}
            disabled={reclaiming || !validHex || !publicKey}
            className="d3-btn-ghost" style={{ ...BTN_GHOST, opacity: (reclaiming || !validHex || !publicKey) ? 0.35 : 1 }}
            data-testid="button-reclaim">
            {reclaiming ? <><Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Reclaiming…</> : "Reclaim Funds"}
          </motion.button>
        )}
        {err && <p style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(220,100,100,0.7)", lineHeight: 1.6, margin: 0 }}>{err}</p>}
      </div>
    </Card>
  );
}

// ─── JupiterTokenPicker ───────────────────────────────────────────────────────
// Searchable token picker. Dropdown uses position:fixed to escape parent
// overflow:hidden (Card panels clip absolute children).
function JupiterTokenPicker({
  value, onChange, exclude, knownList = SWAP_TOKENS, fullWidth = false,
}: {
  value: string;
  onChange: (mint: string, decimals: number) => void;
  exclude?: string;
  knownList?: SwapToken[];
  fullWidth?: boolean;
}) {
  const [open, setOpen]       = useState(false);
  const [query, setQuery]     = useState("");
  const [jupToks, setJupToks] = useState<SwapToken[]>([]);
  const [jLoading, setJLoad]  = useState(false);
  const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 260 });
  const triggerRef = useRef<HTMLButtonElement>(null);

  const cachedForValue = _jupCache.get(value);
  const currentTok =
    knownList.find(t => t.mint === value) ??
    jupToks.find(t => t.mint === value) ??
    cachedForValue ??
    { symbol: value.slice(0, 6).toUpperCase(), mint: value, decimals: 9, name: "Custom" };

  // Debounced Jupiter V2 search — fires whenever query changes (≥1 char)
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 1) { setJupToks([]); return; }
    setJLoad(true);
    const t = setTimeout(() => {
      void searchJupiterTokens(q).then(arr => {
        setJupToks(arr);
        setJLoad(false);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [open, query]);

  function handleOpen() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      const dropW = fullWidth ? r.width : Math.max(260, r.width);
      setDropRect({
        top: r.bottom + 6,
        left: fullWidth ? r.left : Math.max(8, r.right - dropW),
        width: dropW,
      });
    }
    setOpen(o => !o);
    setQuery("");
  }

  function close() { setOpen(false); setQuery(""); }

  const q = query.toLowerCase().trim();

  // Local popular tokens — match symbol/name
  const popularChoices = knownList.filter(t =>
    t.mint !== exclude &&
    (!q || t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
  );

  // Jupiter V2 search results — exclude tokens already in popular list
  const jupExtra = jupToks
    .filter(t => t.mint !== exclude && !knownList.find(k => k.mint === t.mint))
    .slice(0, 30);

  // Allow raw mint paste even if Jupiter doesn't recognize it
  const isCustomMint = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(query.trim()) &&
    !knownList.find(t => t.mint === query.trim()) &&
    !jupToks.find(t => t.mint === query.trim());

  const btnStyle: React.CSSProperties = {
    ...PANEL_SM,
    height: fullWidth ? 46 : 48,
    width: fullWidth ? "100%" : undefined,
    minWidth: fullWidth ? undefined : 92,
    padding: "0 14px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.03em",
    color: C.muted,
    border: `1px solid ${C.border}`,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexShrink: fullWidth ? undefined : 0,
    transition: "border-color 0.15s",
  };

  const rowStyle = (active: boolean): React.CSSProperties => ({
    width: "100%", background: active ? C.surfaceHi : "transparent",
    border: "none", borderRadius: 8, padding: "9px 12px", cursor: "pointer",
    display: "flex", justifyContent: "space-between", alignItems: "center",
    color: C.text, fontSize: 13, fontWeight: 600, textAlign: "left" as const,
    transition: "background 0.1s",
  });

  return (
    <div style={{ position: "relative", flexShrink: fullWidth ? undefined : 0, width: fullWidth ? "100%" : undefined }}>
      <button ref={triggerRef} style={btnStyle} onClick={handleOpen}>
        <span>{currentTok.symbol}</span>
        <span style={{ fontSize: 10, color: C.faint }}>▼</span>
      </button>

      {open && (
        <>
          {/* click-outside overlay — covers entire viewport */}
          <div style={{ position: "fixed", inset: 0, zIndex: 9998 }} onClick={close} />
          {/* dropdown — fixed positioning escapes all overflow:hidden ancestors */}
          <div style={{
            position: "fixed",
            top: dropRect.top,
            left: dropRect.left,
            width: dropRect.width,
            zIndex: 9999,
            background: "#0d0d11",
            border: `1px solid ${C.borderHi}`,
            borderRadius: 14,
            padding: "8px",
            boxShadow: "0 16px 48px rgba(0,0,0,0.85), 0 4px 16px rgba(0,0,0,0.6)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            maxHeight: "min(340px, calc(100vh - 80px))",
          }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or paste mint…"
              style={{ ...INPUT_STYLE, fontSize: 12, height: 38, padding: "0 12px", flexShrink: 0, borderRadius: 8 }}
            />
            <div style={{ overflowY: "auto", maxHeight: 260 }}>
              {popularChoices.map(t => (
                <button key={t.mint} style={rowStyle(t.mint === value)}
                  onClick={() => { onChange(t.mint, t.decimals); close(); }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <TokenLogo mint={t.mint} symbol={t.symbol} size={22} />
                    {t.symbol}
                  </span>
                  <span style={{ fontSize: 11, color: C.dimmed, fontWeight: 400 }}>{t.name}</span>
                </button>
              ))}

              {jupExtra.length > 0 && (
                <>
                  <div style={{ fontSize: 9, color: C.dimmed, fontWeight: 700, letterSpacing: "0.1em", padding: "8px 12px 4px" }}>
                    JUPITER VERIFIED
                  </div>
                  {jupExtra.map(t => (
                    <button key={t.mint} style={rowStyle(t.mint === value)}
                      onClick={() => { onChange(t.mint, t.decimals); close(); }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <TokenLogo mint={t.mint} symbol={t.symbol} size={22} />
                        {t.symbol}
                      </span>
                      <span style={{ fontSize: 11, color: C.dimmed, fontWeight: 400 }}>{t.name}</span>
                    </button>
                  ))}
                </>
              )}

              {isCustomMint && (
                <button style={rowStyle(false)}
                  onClick={() => { onChange(query.trim(), 9); close(); }}>
                  <span style={{ fontFamily: "monospace", fontSize: 11 }}>{query.trim().slice(0, 10)}…</span>
                  <span style={{ fontSize: 11, color: "rgba(120,220,120,0.7)", fontWeight: 400 }}>Use custom mint</span>
                </button>
              )}

              {jLoading && (
                <div style={{ textAlign: "center", padding: "12px 0", fontSize: 11, color: C.dimmed }}>
                  Loading Jupiter tokens…
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Hook: fetch SOL or SPL balance for a given owner address + mint
function useTokenBalance(address: string | null, mint: string, refreshKey: number = 0) {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!address) { setBalance(null); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const owner = new PublicKey(address);
        if (mint === SOL_MINT) {
          const lamps = await connection.getBalance(owner);
          if (!cancelled) setBalance(lamps / LAMPORTS_PER_SOL);
        } else {
          const ata = getAta(new PublicKey(mint), owner);
          try {
            const info = await connection.getTokenAccountBalance(ata);
            if (!cancelled) setBalance(info.value.uiAmount ?? 0);
          } catch {
            if (!cancelled) setBalance(0); // ATA doesn't exist — balance is 0
          }
        }
      } catch {
        if (!cancelled) setBalance(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [address, mint, refreshKey]);
  return { balance, loading };
}

// ─── PrivateSwapView ──────────────────────────────────────────────────────────
//
// Browser-orchestrated private swap using a fresh ephemeral wallet:
//
//   1. Generate ephemeral keypair (in-memory, never sent anywhere)
//   2. User deposits SOL → escrow PDA with secret hash    (user wallet pays)
//   3. Relayer claims escrow → ephemeral wallet           (no on-chain link)
//   4. Ephemeral wallet swaps SOL → output token via Jupiter
//   5. Ephemeral wallet sends output token → destination wallet
//
// The on-chain trail breaks at step 3: chain observers see
//   [user] → [escrow PDA]   and   [escrow PDA] → [fresh wallet]
// but cannot link the user to the destination because the relayer signs
// step 3, and steps 4–5 happen entirely from the ephemeral wallet.
//
// V1 supports SOL as input only (most common case, simplest gas math).
// Token-as-input requires funding the ephemeral wallet with gas first.

type SwapPhase = "idle" | "deposit" | "claim" | "swap" | "transfer" | "done" | "error";

interface PhaseLogEntry { phase: SwapPhase; label: string; status: "pending" | "running" | "ok" | "fail"; sig?: string; }

function PrivateSwapView({ publicKey }: { publicKey: PublicKey | null }) {
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();

  const [outputMint, setOutputMint]     = useState(USDC_MINT);
  const [outputDecimals, setOutputDec]  = useState(6);
  const [amount, setAmount]             = useState("");
  const [destination, setDestination]   = useState("");
  const [useOwnDest, setUseOwnDest]     = useState(true);
  const [phase, setPhase]               = useState<SwapPhase>("idle");
  const [phaseLog, setPhaseLog]         = useState<PhaseLogEntry[]>([]);
  const [error, setError]               = useState<string | null>(null);
  const [ephemeralPubkey, setEphPub]    = useState<string | null>(null);
  const [ephemeralSecret, setEphSec]    = useState<string | null>(null);
  const [balRefresh, setBalRefresh]     = useState(0);

  const inputMint = SOL_MINT;
  const inputDecimals = 9;
  const { quote, loading: qLoading, error: qErr } = useJupiterQuote(inputMint, outputMint, parseFloat(amount) || 0, inputDecimals);

  const outputMeta = resolveTokenMeta(outputMint);
  const { balance: solBalance } = useTokenBalance(publicKey?.toBase58() ?? null, SOL_MINT, balRefresh);

  // Auto-fill destination when "use my wallet" is on
  useEffect(() => {
    if (useOwnDest && publicKey) setDestination(publicKey.toBase58());
  }, [useOwnDest, publicKey]);

  const outAmt = quote
    ? (Number(quote.outAmount) / Math.pow(10, outputDecimals)).toFixed(outputDecimals <= 6 ? 4 : 6)
    : "";

  function setMaxAmount() {
    if (solBalance === null) return;
    // Reserve: 0.005 deposit gas + 0.0025 protocol fee headroom + 0.005 safety
    const reserve = 0.012;
    const usable = Math.max(0, solBalance - reserve);
    setAmount(usable.toFixed(6));
  }

  // Validate destination address
  function isValidDestination(): boolean {
    try { new PublicKey(destination); return destination.length >= 32; }
    catch { return false; }
  }

  const amountNum = parseFloat(amount) || 0;
  const isRunning = phase !== "idle" && phase !== "done" && phase !== "error";
  const canExecute = !!publicKey && !!quote && !qLoading && amountNum >= 0.02 &&
    isValidDestination() && solBalance !== null && amountNum <= (solBalance - 0.012) &&
    !isRunning;

  function logUpdate(target: SwapPhase, status: "running" | "ok" | "fail", sig?: string) {
    setPhaseLog(prev => prev.map(e => e.phase === target ? { ...e, status, sig: sig ?? e.sig } : e));
  }

  async function executePrivateSwap() {
    if (!publicKey || !quote) return;
    setError(null);
    setPhaseLog([
      { phase: "deposit",  label: "Depositing SOL to escrow",      status: "pending" },
      { phase: "claim",    label: "Relayer claiming to fresh wallet", status: "pending" },
      { phase: "swap",     label: "Swapping on Jupiter",            status: "pending" },
      { phase: "transfer", label: "Sending to destination wallet",  status: "pending" },
    ]);

    try {
      const { Keypair, Transaction, SystemProgram, PublicKey: SPK,
              LAMPORTS_PER_SOL: LAMPS, TransactionInstruction,
              VersionedTransaction } = await import("@solana/web3.js");
      const { PLACEHOLDER_PROGRAM_ID } = await import("@workspace/d3fault-shared");

      // ── Step 0: Generate ephemeral wallet (in-memory only) ──────────────────
      const eph = Keypair.generate();
      setEphPub(eph.publicKey.toBase58());
      setEphSec(JSON.stringify(Array.from(eph.secretKey)));

      // ── Step 1: Deposit SOL to escrow with secret hash ──────────────────────
      setPhase("deposit"); logUpdate("deposit", "running");

      const secret = generateSecret();
      const secretHex = toHex(secret);
      const commitment = await computeCommitment(secret);

      const pid = new SPK(PLACEHOLDER_PROGRAM_ID);
      const [csPda] = SPK.findProgramAddressSync([Buffer.from("commitment_store")], pid);
      const expirySec = BigInt(Math.floor(Date.now() / 1000) + 900); // 15min — relayer claim happens immediately
      const lamports = BigInt(Math.round(amountNum * LAMPS));
      const feeLamps = lamports * BigInt(PROTOCOL_FEE_BPS) / 10000n;

      const data = new Uint8Array(56);
      const dv = new DataView(data.buffer);
      const disc = new Uint8Array([0x6c, 0x51, 0x4e, 0x75, 0x7d, 0x9b, 0x38, 0xc8]);
      data.set(disc, 0); data.set(commitment, 8);
      dv.setBigUint64(40, lamports, true);
      dv.setBigInt64(48, expirySec, true);

      const depositTx = new Transaction();
      // Protocol fee → relayer
      depositTx.add(new TransactionInstruction({
        programId: SystemProgram.programId,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: RELAYER_FEE_PUBKEY, isSigner: false, isWritable: true },
        ],
        data: (() => { const d = Buffer.alloc(12); d.writeUInt32LE(2, 0); d.writeBigInt64LE(feeLamps, 4); return d; })(),
      }));
      // Deposit ix
      depositTx.add(new TransactionInstruction({
        programId: pid,
        keys: [
          { pubkey: csPda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(data),
      }));

      const { blockhash } = await connection.getLatestBlockhash();
      depositTx.recentBlockhash = blockhash; depositTx.feePayer = publicKey;
      const w = wallets.find(wl => wl.address === publicKey.toBase58()) ?? wallets[0];
      if (!w) throw new Error("No wallet found");
      const { signedTransaction: depSigned } = await signTransaction({
        transaction: depositTx.serialize({ requireAllSignatures: false }), wallet: w,
      });
      const depSig = await connection.sendRawTransaction(depSigned);
      await connection.confirmTransaction(depSig, "confirmed");
      logUpdate("deposit", "ok", depSig);

      // ── Step 2: Relayer claims escrow → ephemeral wallet ────────────────────
      setPhase("claim"); logUpdate("claim", "running");

      const claimRes = await fetch("/api/relay-withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: secretHex, recipient: eph.publicKey.toBase58() }),
      });
      if (!claimRes.ok) {
        const errBody = await claimRes.json().catch(() => ({ error: "Relay failed" })) as { error: string };
        throw new Error(`Claim failed: ${errBody.error}`);
      }
      const { signature: claimSig } = await claimRes.json() as { signature: string };
      logUpdate("claim", "ok", claimSig);

      // Wait briefly for ephemeral wallet to see the lamports (RPC propagation)
      let ephLamports = 0;
      for (let i = 0; i < 10; i++) {
        ephLamports = await connection.getBalance(eph.publicKey, "confirmed");
        if (ephLamports >= Number(lamports) - 100) break;
        await new Promise(r => setTimeout(r, 800));
      }
      if (ephLamports < Number(lamports) / 2) {
        throw new Error(`Ephemeral wallet did not receive funds (got ${ephLamports} lamports)`);
      }

      // ── Step 3: Ephemeral wallet swaps SOL → output token on Jupiter ────────
      setPhase("swap"); logUpdate("swap", "running");

      // Reserve gas for the swap tx + final transfer + ATA creation
      const GAS_RESERVE = 10_000_000; // 0.01 SOL
      const swapAmount = ephLamports - GAS_RESERVE;
      if (swapAmount <= 0) throw new Error("Insufficient SOL after gas reserve");

      const quoteRes = await fetch(
        `${JUP_QUOTE_API}?inputMint=${SOL_MINT}&outputMint=${outputMint}&amount=${swapAmount}&slippageBps=150`
      );
      if (!quoteRes.ok) throw new Error("Failed to fetch swap quote");
      const swapQuote = await quoteRes.json();

      const swapTxRes = await fetch(JUP_SWAP_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: swapQuote,
          userPublicKey: eph.publicKey.toBase58(),
          wrapAndUnwrapSol: true,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      });
      if (!swapTxRes.ok) throw new Error("Failed to build swap transaction");
      const { swapTransaction } = await swapTxRes.json() as { swapTransaction: string };

      const swapTxBytes = Buffer.from(swapTransaction, "base64");
      const swapTx = VersionedTransaction.deserialize(swapTxBytes);
      swapTx.sign([eph]);
      const swapSig = await connection.sendRawTransaction(swapTx.serialize(), { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction(swapSig, "confirmed");
      logUpdate("swap", "ok", swapSig);

      // ── Step 4: Ephemeral wallet sends output token → destination ───────────
      setPhase("transfer"); logUpdate("transfer", "running");

      const { createTransferInstruction, createAssociatedTokenAccountInstruction,
              getAssociatedTokenAddressSync } = await import("@solana/spl-token");

      const outMintPK = new SPK(outputMint);
      const destPK = new SPK(destination);
      const ephAta = getAssociatedTokenAddressSync(outMintPK, eph.publicKey);
      const destAta = getAssociatedTokenAddressSync(outMintPK, destPK);

      // Wait for swap output to land in ephemeral ATA
      let ephTokenAmount = 0n;
      for (let i = 0; i < 10; i++) {
        try {
          const info = await connection.getTokenAccountBalance(ephAta, "confirmed");
          ephTokenAmount = BigInt(info.value.amount);
          if (ephTokenAmount > 0n) break;
        } catch { /* ATA may not exist yet */ }
        await new Promise(r => setTimeout(r, 800));
      }
      if (ephTokenAmount === 0n) throw new Error("Swap output not received in ephemeral wallet");

      const transferTx = new Transaction();
      const destAtaInfo = await connection.getAccountInfo(destAta);
      if (!destAtaInfo) {
        transferTx.add(createAssociatedTokenAccountInstruction(
          eph.publicKey, destAta, destPK, outMintPK
        ));
      }
      transferTx.add(createTransferInstruction(ephAta, destAta, eph.publicKey, ephTokenAmount));

      const { blockhash: tBh } = await connection.getLatestBlockhash();
      transferTx.recentBlockhash = tBh; transferTx.feePayer = eph.publicKey;
      transferTx.partialSign(eph);
      const transferSig = await connection.sendRawTransaction(transferTx.serialize(), { skipPreflight: false, maxRetries: 3 });
      await connection.confirmTransaction(transferSig, "confirmed");
      logUpdate("transfer", "ok", transferSig);

      setPhase("done");
      setBalRefresh(n => n + 1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Private swap failed";
      const logs: string[] | undefined = (e as { logs?: string[] }).logs;
      const detail = logs?.length ? `${msg}\n\nLogs:\n${logs.slice(-4).join("\n")}` : msg;
      setError(detail);
      setPhase("error");
      setPhaseLog(prev => prev.map(e => e.status === "running" ? { ...e, status: "fail" } : e));
    }
  }

  function reset() {
    setPhase("idle"); setPhaseLog([]); setError(null);
    setEphPub(null); setEphSec(null); setAmount("");
  }

  function downloadEphemeralKey() {
    if (!ephemeralSecret) return;
    const blob = new Blob([ephemeralSecret], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ephemeral-${ephemeralPubkey?.slice(0, 8)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  const phaseColor = (s: PhaseLogEntry["status"]) =>
    s === "ok" ? "rgba(120,220,140,0.9)"
    : s === "fail" ? "rgba(220,100,100,0.9)"
    : s === "running" ? "rgba(220,180,80,0.9)"
    : C.dimmed;

  return (
    <motion.div>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <SectionHeader
          eyebrow="Trade"
          title="Private swap"
          description="Swap SOL into any token without leaving an on-chain link between your wallet and the destination."
          icon={<ArrowDownUp style={{ width: 16, height: 16 }} />}
          right={<ContextChip icon={<Shield style={{ width: 10, height: 10 }} />} label="UNLINKED ROUTING" />}
        />
      </div>
      <Card style={{ maxWidth: 480, margin: "0 auto" }}>
        <CardHead>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LockIcon style={{ width: 13, height: 13, color: C.faint }} />
            <FieldLabel>Private Swap</FieldLabel>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Activity style={{ width: 13, height: 13, color: C.faint }} />
            <span style={{ fontSize: 10, color: C.dimmed, fontWeight: 600, letterSpacing: "0.06em" }}>JUPITER · UNLINKED</span>
          </div>
        </CardHead>

        {/* Privacy explainer */}
        <div style={{ padding: "14px 20px", borderBottom: DIVIDER, background: "rgba(0,0,0,0.2)" }}>
          <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.6 }}>
            Swap SOL into any token <strong style={{ color: C.muted }}>without leaving an on-chain link</strong> between
            your wallet and the destination. Routed through escrow → fresh wallet → Jupiter → destination.
          </div>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* You Pay */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <FieldLabel>You Pay</FieldLabel>
              {publicKey && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "monospace", color: C.dimmed }}>
                  <Wallet style={{ width: 10, height: 10, opacity: 0.6 }} />
                  <span>Balance:</span>
                  <span style={{ color: C.faint, fontWeight: 600 }}>
                    {solBalance === null ? <Skeleton w={60} h={10} /> : <>{solBalance.toFixed(solBalance < 1 ? 6 : 4)} SOL</>}
                  </span>
                  {solBalance !== null && solBalance > 0.012 && (
                    <button onClick={setMaxAmount} disabled={isRunning}
                      style={{
                        background: "rgba(180,180,180,0.08)", border: `1px solid ${C.border}`, color: C.faint,
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 5,
                        cursor: isRunning ? "not-allowed" : "pointer", fontFamily: "monospace", marginLeft: 2,
                      }}
                      data-testid="button-priv-swap-max"
                    >MAX</button>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...INPUT_STYLE, flex: 1, fontSize: 20, fontWeight: 500, fontFamily: "monospace" }}
                placeholder="0.02" type="number" min="0" step="0.001" value={amount} disabled={isRunning}
                onChange={e => setAmount(e.target.value)} data-testid="input-priv-swap-amount" />
              <div style={{ ...PANEL_SM, height: 48, padding: "0 14px", display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
                <TokenLogo mint={SOL_MINT} symbol="SOL" size={22} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>SOL</span>
              </div>
            </div>
            {amountNum > 0 && amountNum < 0.02 && (
              <div style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(220,160,80,0.7)" }}>
                Minimum 0.02 SOL (covers gas + meaningful swap)
              </div>
            )}
            {solBalance !== null && amountNum > (solBalance - 0.012) && (
              <div style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(220,100,100,0.7)" }}>
                Insufficient balance (need {(amountNum + 0.012).toFixed(4)} SOL incl. fees)
              </div>
            )}
          </div>

          {/* Arrow divider */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ ...PANEL_SM, width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.border}` }}>
              <ArrowDownUp style={{ width: 15, height: 15, color: C.muted }} />
            </div>
          </div>

          {/* You Receive */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <FieldLabel>You Receive</FieldLabel>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...INPUT_STYLE, flex: 1, fontSize: 20, fontWeight: 500, fontFamily: "monospace", color: C.muted }}
                placeholder="0.00" type="number" readOnly value={qLoading ? "" : outAmt}
                data-testid="input-priv-swap-output" />
              <JupiterTokenPicker value={outputMint} exclude={SOL_MINT}
                onChange={(mint, dec) => { setOutputMint(mint); setOutputDec(dec); setAmount(""); }} />
            </div>
          </div>

          {/* Destination wallet */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <FieldLabel>Destination Wallet</FieldLabel>
              <label style={{ fontSize: 10, color: C.dimmed, display: "flex", alignItems: "center", gap: 5, cursor: isRunning ? "not-allowed" : "pointer" }}>
                <input type="checkbox" checked={useOwnDest} disabled={isRunning}
                  onChange={e => setUseOwnDest(e.target.checked)}
                  style={{ accentColor: C.muted, cursor: isRunning ? "not-allowed" : "pointer" }} />
                Use my wallet
              </label>
            </div>
            <input style={{ ...INPUT_STYLE, fontSize: 12, fontFamily: "monospace", height: 42, padding: "0 12px" }}
              placeholder="Solana address that will receive the swapped tokens"
              value={destination} disabled={useOwnDest || isRunning}
              onChange={e => setDestination(e.target.value)} data-testid="input-priv-swap-dest" />
            {destination && !isValidDestination() && (
              <div style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(220,100,100,0.7)" }}>
                Invalid Solana address
              </div>
            )}
          </div>

          {/* Quote info */}
          {(qLoading || quote || qErr) && (
            <div style={{ background: "rgba(0,0,0,0.3)", border: DIVIDER, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
              {qLoading && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 10, color: C.dimmed, fontFamily: "monospace", letterSpacing: "0.06em", display: "flex", alignItems: "center", gap: 6 }}>
                    <Loader2 style={{ width: 11, height: 11, animation: "spin 1s linear infinite" }} /> Fetching best route…
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><Skeleton w={70} h={9} /><Skeleton w={50} h={9} /></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><Skeleton w={50} h={9} /><Skeleton w={70} h={9} /></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><Skeleton w={80} h={9} /><Skeleton w={60} h={9} /></div>
                </div>
              )}
              {qErr && <div style={{ fontSize: 11, color: "rgba(220,100,100,0.6)", fontFamily: "monospace" }}>Quote unavailable</div>}
              {quote && !qLoading && <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "monospace", color: C.dimmed }}>
                  <span>Price impact</span><span style={{ color: C.faint }}>{parseFloat(String(quote.priceImpactPct)).toFixed(3)}%</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "monospace", color: C.dimmed }}>
                  <span>Route</span><span style={{ color: C.faint }}>{quote.routePlan[0]?.swapInfo?.label ?? "JUP"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "monospace", color: C.dimmed }}>
                  <span>Protocol fee</span><span style={{ color: C.faint }}>0.25% of deposit</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "monospace", color: C.dimmed }}>
                  <span>Gas reserve</span><span style={{ color: C.faint }}>~0.012 SOL (deposit + swap + transfer)</span>
                </div>
              </>}
            </div>
          )}

          {/* Phase log */}
          {phaseLog.length > 0 && (
            <div style={{ background: "rgba(0,0,0,0.3)", border: DIVIDER, borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 9, color: C.dimmed, fontWeight: 700, letterSpacing: "0.1em" }}>EXECUTION PROGRESS</div>
              {ephemeralPubkey && (
                <div style={{ fontSize: 10, fontFamily: "monospace", color: C.faint, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 6 }}>
                  <Key style={{ width: 11, height: 11, opacity: 0.6 }} />
                  <span style={{ opacity: 0.6 }}>Ephemeral:</span>
                  <span style={{ color: C.muted }}>{ephemeralPubkey.slice(0,8)}…{ephemeralPubkey.slice(-6)}</span>
                </div>
              )}
              {phaseLog.map((entry, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, fontFamily: "monospace" }}>
                  <span style={{ width: 14, height: 14, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {entry.status === "ok"      && <span style={{ color: phaseColor(entry.status), fontWeight: 700 }}>✓</span>}
                    {entry.status === "fail"    && <span style={{ color: phaseColor(entry.status), fontWeight: 700 }}>✕</span>}
                    {entry.status === "running" && <Loader2 style={{ width: 11, height: 11, color: phaseColor(entry.status), animation: "spin 1s linear infinite" }} />}
                    {entry.status === "pending" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: phaseColor(entry.status), opacity: 0.4 }} />}
                  </span>
                  <span style={{ color: phaseColor(entry.status), flex: 1 }}>{entry.label}</span>
                  {entry.sig && (
                    <a href={`https://solscan.io/tx/${entry.sig}${EXPLORER_CLUSTER}`} target="_blank" rel="noreferrer"
                      style={{ color: C.dimmed, fontSize: 10, display: "flex", alignItems: "center", gap: 3 }}>
                      {entry.sig.slice(0,6)} <ExternalLink style={{ width: 9, height: 9 }} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div style={{ background: "rgba(220,60,60,0.06)", border: "1px solid rgba(220,60,60,0.18)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <p style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(220,140,140,0.85)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{error}</p>
              {ephemeralSecret && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 8, borderTop: "1px solid rgba(220,60,60,0.15)" }}>
                  <div style={{ fontSize: 10, color: "rgba(220,180,80,0.85)", fontFamily: "monospace", lineHeight: 1.5 }}>
                    ⚠ Funds may be in the ephemeral wallet. Download the keypair to recover them manually.
                  </div>
                  <button onClick={downloadEphemeralKey}
                    className="d3-btn-primary" style={{ ...BTN_PRIMARY, fontSize: 11, padding: "8px 12px", background: "rgba(220,140,80,0.15)", color: "rgba(255,200,140,0.95)", border: "1px solid rgba(220,140,80,0.3)" }}>
                    <Download style={{ width: 12, height: 12 }} /> Download ephemeral keypair
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Success state */}
          {phase === "done" && (
            <div style={{ background: "rgba(80,200,120,0.06)", border: "1px solid rgba(80,200,120,0.2)", borderRadius: 10, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(140,230,160,0.95)" }}>✓ Private swap complete</div>
              <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.6 }}>
                {outAmt} {outputMeta.symbol} sent to <span style={{ fontFamily: "monospace", color: C.muted }}>{destination.slice(0,6)}…{destination.slice(-6)}</span>.
                On-chain link to your source wallet has been broken via the ephemeral wallet.
              </div>
            </div>
          )}

          {/* Action button */}
          {phase === "done" || phase === "error" ? (
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={reset}
              className="d3-btn-primary" style={{ ...BTN_PRIMARY }} data-testid="button-priv-swap-reset">
              Start New Private Swap
            </motion.button>
          ) : (
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              onClick={() => void executePrivateSwap()}
              disabled={!canExecute}
              className="d3-btn-primary" style={{ ...BTN_PRIMARY, opacity: canExecute ? 1 : 0.38 }}
              data-testid="button-priv-swap-execute">
              {isRunning
                ? <><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> Processing…</>
                : <><LockIcon style={{ width: 14, height: 14 }} /> Execute Private Swap</>}
            </motion.button>
          )}

          {!publicKey && (
            <div style={{ fontSize: 10, fontFamily: "monospace", color: "rgba(220,160,80,0.7)", textAlign: "center" }}>
              Connect a wallet to start
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ─── ReceiveView ──────────────────────────────────────────────────────────────
function ReceiveView({ publicKey }: { publicKey: PublicKey | null }) {
  const { wallet: browserWallet } = useBrowserWallet();
  const [mode, setMode]           = useState<"direct" | "private">("direct");
  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);

  const [link, setLink]           = useState("");
  const [parsed, setParsed]       = useState<{ secret: string } | null>(null);
  const [parseErr, setParseErr]   = useState<string | null>(null);
  const [commitment, setCommitment] = useState<string | null>(null);
  const [status, setStatus]       = useState<"idle" | "claiming" | "success" | "error">("idle");
  const [txSig, setTxSig]         = useState<string | null>(null);
  const [claimErr, setClaimErr]   = useState<string | null>(null);

  const withdrawMutation = useRelayWithdraw();

  // Address picker — default to Privy connected wallet
  const wallets_ = [
    publicKey       ? { addr: publicKey.toBase58(),     label: "Connected Wallet", badge: "PRIVY" } : null,
    browserWallet   ? { addr: browserWallet.publicKey,  label: "Browser Wallet",   badge: "LOCAL" } : null,
  ].filter((w): w is { addr: string; label: string; badge: string } => w !== null);
  const activeAddr = selectedAddr ?? wallets_[0]?.addr ?? null;
  const activeWallet = wallets_.find(w => w.addr === activeAddr) ?? wallets_[0];

  function copyActive() {
    if (!activeAddr) return;
    void navigator.clipboard.writeText(activeAddr);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 1500);
  }

  function handlePaste(raw: string) {
    setLink(raw);
    setParseErr(null);
    setParsed(null);
    setCommitment(null);
    setStatus("idle");
    setTxSig(null);
    setClaimErr(null);
    if (!raw.trim()) return;
    const hash = raw.includes("#") ? "#" + raw.split("#").slice(1).join("#") : raw.trim();
    const p = parseClaimHash(hash);
    if (!p) { setParseErr("Invalid claim secret — paste the full secret starting with # (or just the 64-char hex)."); return; }
    setParsed(p);
    const secret = new Uint8Array(p.secret.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    void computeCommitment(secret).then(c => setCommitment(toHex(c).slice(0, 14) + "…"));
  }

  async function handleClaim() {
    if (!publicKey || !parsed) return;
    setStatus("claiming"); setClaimErr(null);
    withdrawMutation.mutate(
      { data: { secret: parsed.secret, recipient: publicKey.toBase58() } },
      {
        onSuccess: (data) => { setTxSig(data.signature); setStatus("success"); },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Claim failed";
          setClaimErr(msg); setStatus("error");
        },
      }
    );
  }

  const canClaim = !!parsed && !!publicKey && status === "idle";

  return (
    <motion.div
      style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 500, margin: "0 auto" }}>

      <SectionHeader
        eyebrow="Receive"
        title="Receive funds"
        description="Share your address for direct transfers, or paste a D3FAULT claim link to pull a private payment."
        icon={<QrCode style={{ width: 16, height: 16 }} />}
      />

      {/* ── Mode toggle ───────────────────────────────────────────────────── */}
      <div style={{ ...PANEL, padding: 4, borderRadius: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, background: "rgba(0,0,0,0.3)" }}>
        {[
          { v: "direct",  label: "My Address", icon: QrCode },
          { v: "private", label: "Claim Private", icon: Shield },
        ].map(({ v, label, icon: Icon }) => {
          const active = mode === v;
          return (
            <button key={v} onClick={() => setMode(v as "direct" | "private")}
              style={{ height: 38, borderRadius: 9, border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: 12, fontWeight: active ? 700 : 500, letterSpacing: "0.02em",
                color: active ? "#fff" : "rgba(255,255,255,0.32)",
                background: active ? "linear-gradient(160deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.06) 100%)" : "transparent",
                boxShadow: active ? "0 1px 0 rgba(255,255,255,0.12) inset, 0 2px 8px rgba(0,0,0,0.25)" : "none",
                fontFamily: "'Space Grotesk', 'Inter', sans-serif", transition: "all 0.15s ease",
              }}>
              <Icon style={{ width: 13, height: 13, opacity: active ? 1 : 0.5 }} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── DIRECT MODE: QR + address ─────────────────────────────────────── */}
      {mode === "direct" && (
        <Card>
          <CardHead>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <QrCode style={{ width: 13, height: 13, color: C.faint }} />
              <FieldLabel>Your Address</FieldLabel>
            </div>
            <span style={{ fontSize: 10, color: C.dimmed, fontWeight: 600, letterSpacing: "0.06em" }}>SCAN OR COPY</span>
          </CardHead>
          <div style={{ padding: "22px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Wallet selector pills */}
            {wallets_.length > 1 && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${wallets_.length}, 1fr)`, gap: 6, padding: 4, background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border}`, borderRadius: 10 }}>
                {wallets_.map(w => {
                  const active = w.addr === activeAddr;
                  return (
                    <button key={w.addr} onClick={() => setSelectedAddr(w.addr)}
                      style={{ height: 34, borderRadius: 7, border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 11, fontWeight: active ? 700 : 500,
                        color: active ? C.text : C.muted,
                        background: active ? "rgba(255,255,255,0.10)" : "transparent",
                        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                      }}>
                      <span>{w.label}</span>
                      <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: C.dimmed, background: "rgba(255,255,255,0.06)", padding: "2px 5px", borderRadius: 3 }}>{w.badge}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {/* QR code */}
            {activeAddr ? (
              <>
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    style={{ position: "relative", padding: 4, borderRadius: 18 }}
                  >
                    <span
                      aria-hidden
                      className="d3-rotate-slow"
                      style={{
                        position: "absolute", inset: -1, borderRadius: 19,
                        background: "conic-gradient(from 0deg, rgba(255,255,255,0.35), rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.35) 50%, rgba(255,255,255,0.04) 75%, rgba(255,255,255,0.35) 100%)",
                        filter: "blur(8px)",
                        opacity: 0.55,
                        zIndex: 0,
                      }}
                    />
                    <div style={{ position: "relative", background: "#fff", padding: 16, borderRadius: 14, boxShadow: "0 4px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)", zIndex: 1 }}>
                      <QRCodeSVG value={activeAddr} size={208} bgColor="#ffffff" fgColor="#000000" level="M" />
                    </div>
                  </motion.div>
                </div>
                <div>
                  <FieldLabel>{activeWallet?.label ?? "Address"}</FieldLabel>
                  <div style={{ marginTop: 7, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "rgba(0,0,0,0.4)", border: `1px solid ${C.border}`, borderRadius: 10 }}>
                    <span style={{ flex: 1, fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 11, color: C.muted, wordBreak: "break-all", lineHeight: 1.55 }}>{activeAddr}</span>
                    <button onClick={copyActive} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", color: copiedAddr ? "rgba(120,220,120,0.85)" : C.faint, flexShrink: 0 }}>
                      {copiedAddr ? <CheckCircle2 style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                    </button>
                    <a href={`https://solscan.io/account/${activeAddr}${EXPLORER_CLUSTER}`} target="_blank" rel="noreferrer" style={{ display: "flex", color: C.dimmed, padding: 4 }}>
                      <ExternalLink style={{ width: 14, height: 14 }} />
                    </a>
                  </div>
                </div>
                <p style={{ fontSize: 10, color: C.dimmed, margin: 0, lineHeight: 1.65, fontFamily: "monospace", textAlign: "center" }}>
                  Send only Solana / SPL tokens to this address. Other networks will lose funds.
                </p>
              </>
            ) : (
              <div style={{ padding: "40px 20px", textAlign: "center", color: C.dimmed, fontSize: 12 }}>Connect a wallet to see your address.</div>
            )}
          </div>
        </Card>
      )}

      {/* ── PRIVATE CLAIM MODE ────────────────────────────────────────────── */}
      {mode === "private" && (
      <Card>
        <CardHead>
          <FieldLabel>Claim Transfer</FieldLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Shield style={{ width: 13, height: 13, color: C.faint }} />
            <span style={{ fontSize: 10, color: C.dimmed, fontWeight: 600, letterSpacing: "0.06em" }}>PRIVATE RECEIVE</span>
          </div>
        </CardHead>

        <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <FieldLabel>Paste Claim Secret</FieldLabel>
            <textarea
              value={link}
              onChange={e => handlePaste(e.target.value)}
              placeholder="#abc123… or paste the raw 64-char hex"
              rows={3}
              style={{
                ...INPUT_STYLE, height: "auto", minHeight: 72, padding: "12px 14px",
                resize: "none", fontFamily: "monospace", fontSize: 11,
                lineHeight: 1.6, wordBreak: "break-all",
              }}
            />
            {parseErr && (
              <span style={{ fontSize: 10, color: "rgba(220,100,100,0.65)", fontFamily: "monospace" }}>{parseErr}</span>
            )}
          </div>

          {parsed && commitment && status !== "success" && (
            <div style={{ background: "rgba(0,0,0,0.3)", border: DIVIDER, borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "monospace", color: C.dimmed }}>
                <span>Commitment</span><span style={{ color: C.faint }}>{commitment}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "monospace", color: C.dimmed }}>
                <span>Recipient</span>
                <span style={{ color: C.faint }}>
                  {publicKey ? `${publicKey.toBase58().slice(0,6)}…${publicKey.toBase58().slice(-4)}` : <ContextChip label="NO WALLET" tone="warn" />}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "monospace", color: C.dimmed }}>
                <span>Gas</span><span style={{ color: "rgba(100,200,120,0.6)" }}>covered by protocol</span>
              </div>
            </div>
          )}

          {status === "claiming" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "16px 0", fontSize: 12, color: C.dimmed }}>
              <Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} />
              <span>Submitting to relayer…</span>
            </div>
          )}

          {status === "success" && txSig && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "12px 0" }}>
              <CheckCircle2 style={{ width: 28, height: 28, color: "rgba(100,200,120,0.7)" }} />
              <span style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>Claimed successfully</span>
              <a href={`https://solscan.io/tx/${txSig}${EXPLORER_CLUSTER}`} target="_blank" rel="noreferrer"
                style={{ fontFamily: "monospace", fontSize: 10, color: C.faint, display: "flex", alignItems: "center", gap: 5 }}>
                <ExternalLink style={{ width: 10, height: 10 }} /> View on Explorer
              </a>
            </div>
          )}

          {status === "error" && claimErr && (
            <p style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(220,100,100,0.65)", lineHeight: 1.6, margin: 0 }}>{claimErr}</p>
          )}

          {status !== "success" && (
            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              onClick={() => void handleClaim()}
              disabled={!canClaim}
              className="d3-btn-primary" style={{ ...BTN_PRIMARY, opacity: canClaim ? 1 : 0.38, display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              {status === "claiming"
                ? <><Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Claiming…</>
                : status === "error"
                  ? <><RotateCcw style={{ width: 13, height: 13 }} /> Try Again</>
                  : <><ArrowRight style={{ width: 14, height: 14 }} /> Claim Funds</>
              }
            </motion.button>
          )}

          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14, fontSize: 10, color: C.faint, lineHeight: 1.7, fontFamily: "monospace" }}>
            <Link2 style={{ width: 10, height: 10, display: "inline", verticalAlign: "middle", marginRight: 5 }} />
            Paste the claim secret from the Send tab. Relayer covers gas — you only need a wallet address to claim.
          </div>
        </div>
      </Card>
      )}
    </motion.div>
  );
}

// ─── TransferView ─────────────────────────────────────────────────────────────
function TransferView({ publicKey, onDeposited, presetSource, clearPreset }: { publicKey: PublicKey | null; onDeposited: () => void; presetSource?: string | null; clearPreset?: () => void }) {
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const { wallet: browserWallet } = useBrowserWallet();

  // ── Mode (private vs direct) ───────────────────────────────────────────────
  const [mode, setMode] = useState<"private" | "direct">("private");

  // ── Private-send state ─────────────────────────────────────────────────────
  const [step, setStep]             = useState<1 | 2 | 3>(1);
  const [link, setLink]             = useState("");
  const [amount, setAmount]         = useState("");
  const [expiry, setExpiry]         = useState(EXPIRY_PRESETS[1].seconds);
  const [sendMint, setSendMint]     = useState(SOL_SENTINEL);
  const [sendDec, setSendDec]       = useState(9);
  const [depositing, setDepositing] = useState(false);
  const [depositErr, setDepositErr] = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);

  const sendToken = PRIVATE_TOKENS.find(t => t.mint === sendMint) ?? PRIVATE_TOKENS[0];
  const isSolSend = sendMint === SOL_SENTINEL;

  // ── Direct-send state ──────────────────────────────────────────────────────
  const [dirSource, setDirSource]       = useState<"privy" | "browser">("privy");
  const [dirRecipient, setDirRecipient] = useState("");
  const [dirAmount, setDirAmount]       = useState("");
  const [dirMint, setDirMint]           = useState(SOL_SENTINEL);
  const [dirDec, setDirDec]             = useState(9);
  const [dirBusy, setDirBusy]           = useState(false);
  const [dirErr, setDirErr]             = useState<string | null>(null);
  const [dirSig, setDirSig]             = useState<string | null>(null);
  const [dirRefresh, setDirRefresh]     = useState(0);

  // Resolve preset (clicked "Send" from a wallet card → direct mode + matching source)
  useEffect(() => {
    if (!presetSource) return;
    setMode("direct");
    if (browserWallet?.publicKey === presetSource) setDirSource("browser");
    else setDirSource("privy");
    clearPreset?.();
  }, [presetSource, browserWallet?.publicKey, clearPreset]);

  const dirSourceAddress = dirSource === "privy"
    ? (publicKey?.toBase58() ?? null)
    : (browserWallet?.publicKey ?? null);
  const dirIsSol = dirMint === SOL_SENTINEL;
  const dirToken = PRIVATE_TOKENS.find(t => t.mint === dirMint) ?? PRIVATE_TOKENS[0];
  // SOL is always fetched (needed both as the main asset for SOL sends and as
  // the fee/rent reserve for SPL sends). The token balance is only fetched
  // when the user is sending an SPL token.
  const { bal: dirSolBal } = useSolBalance(dirSourceAddress, dirRefresh);
  const { balance: dirSplBal } = useTokenBalance(!dirIsSol ? dirSourceAddress : null, dirMint, dirRefresh);
  const dirBalance: number | null = dirIsSol ? dirSolBal : (dirSplBal ?? null);

  // Browser-wallet selector availability
  const hasBrowser = !!browserWallet;
  // If user picks "browser" but no browser wallet, fall back
  useEffect(() => { if (dirSource === "browser" && !hasBrowser) setDirSource("privy"); }, [dirSource, hasBrowser]);

  // Validate recipient
  function isValidRecipient(addr: string): boolean {
    try { new PublicKey(addr); return addr.length >= 32; } catch { return false; }
  }
  const dirAmountNum = parseFloat(dirAmount) || 0;
  // Reserve SOL for: tx fee (~0.000005) + potential ATA creation rent (~0.00204).
  // For SOL sends this is taken out of the amount; for SPL sends it must be
  // available *in addition* to the SPL balance.
  const SOL_FEE_RESERVE_NATIVE = 0.005; // generous fee buffer when sending SOL itself
  const SOL_FEE_RESERVE_SPL    = 0.003; // fee + ATA rent buffer when sending SPL
  const dirHasFeeSol = dirSolBal !== null && dirSolBal >= SOL_FEE_RESERVE_SPL;
  const dirAmountValid = dirIsSol
    ? (dirBalance !== null && dirAmountNum > 0 && dirAmountNum <= dirBalance - SOL_FEE_RESERVE_NATIVE)
    : (dirBalance !== null && dirAmountNum > 0 && dirAmountNum <= dirBalance && dirHasFeeSol);
  const dirCanSend = !!dirSourceAddress && isValidRecipient(dirRecipient) && dirAmountValid && !dirBusy;

  function setDirMax() {
    if (dirBalance === null) return;
    const usable = dirIsSol ? Math.max(0, dirBalance - SOL_FEE_RESERVE_NATIVE) : dirBalance;
    setDirAmount(usable.toFixed(dirDec <= 6 ? 6 : 9));
  }

  async function executeDirectSend() {
    if (!dirSourceAddress || !dirCanSend) return;
    setDirBusy(true); setDirErr(null); setDirSig(null);
    try {
      const { Transaction, SystemProgram, PublicKey: SPK, LAMPORTS_PER_SOL: LAMPS } = await import("@solana/web3.js");
      const fromPK = new SPK(dirSourceAddress);
      const toPK   = new SPK(dirRecipient);
      const tx = new Transaction();

      if (dirIsSol) {
        const lamports = BigInt(Math.round(dirAmountNum * LAMPS));
        tx.add(SystemProgram.transfer({ fromPubkey: fromPK, toPubkey: toPK, lamports: Number(lamports) }));
      } else {
        const { createTransferInstruction, createAssociatedTokenAccountIdempotentInstruction,
                getAssociatedTokenAddressSync } = await import("@solana/spl-token");
        const mintPK = new SPK(dirMint);
        const fromAta = getAssociatedTokenAddressSync(mintPK, fromPK);
        const toAta   = getAssociatedTokenAddressSync(mintPK, toPK);
        // Idempotent ATA creation for recipient (paid by sender)
        tx.add(createAssociatedTokenAccountIdempotentInstruction(fromPK, toAta, toPK, mintPK));
        const rawAmt = BigInt(Math.round(dirAmountNum * Math.pow(10, dirDec)));
        tx.add(createTransferInstruction(fromAta, toAta, fromPK, rawAmt));
      }

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash; tx.feePayer = fromPK;

      let sig: string;
      if (dirSource === "privy") {
        const w = wallets.find(wl => wl.address === dirSourceAddress) ?? wallets[0];
        if (!w) throw new Error("No connected wallet found");
        const { signedTransaction } = await signTransaction({
          transaction: tx.serialize({ requireAllSignatures: false }), wallet: w,
        });
        sig = await connection.sendRawTransaction(signedTransaction);
      } else {
        if (!browserWallet?.keypair) throw new Error("Browser wallet is locked or unavailable");
        tx.sign(browserWallet.keypair);
        sig = await connection.sendRawTransaction(tx.serialize());
      }
      await connection.confirmTransaction(sig, "confirmed");
      setDirSig(sig);
      setDirAmount("");
      setDirRefresh(n => n + 1);
      onDeposited();
    } catch (e) {
      const logs: string[] | undefined = (e as { logs?: string[] }).logs;
      const msg = e instanceof Error ? e.message : "Send failed";
      const detail = logs?.length ? `${msg}\n${logs.slice(-3).join(" | ")}` : msg;
      setDirErr(detail);
    } finally { setDirBusy(false); }
  }

  // Protocol initialization state — sourced from API server which checks the PDA on-chain.
  // "ready"  → CommitmentStore initialized (owned by program) — deposits work
  // "stuck"  → PDA exists with lamports, System-owned (devnet broken state) — init blocked
  // "clean"  → PDA empty (normal uninitialized) — deployer can run init
  // null     → still loading
  type CsState = "ready" | "stuck" | "clean" | null;
  const { data: transferProgramInfo, refetch: refetchProgramInfo } = useGetProgramInfo();
  const [csForced, setCsForced]     = useState(false);   // bypass for test mode
  const [csInitFailed, setCsInitFailed] = useState(false); // init permanently blocked (realloc limit hit)
  const [initializing, setInit]     = useState(false);
  const [initErr, setInitErr]       = useState<string | null>(null);

  // Derive from server response — server-side RPC is reliable, client-side Buffer/hook issues don't apply.
  // If init was attempted and failed with the allocate/realloc size limit, treat as "stuck".
  const csStateRaw: CsState = !transferProgramInfo
    ? null
    : (transferProgramInfo.commitmentStoreState ?? "clean");
  const csState: CsState = csInitFailed ? "stuck" : csStateRaw;

  // Derived: should the deposit form be enabled?
  const csReady = csForced || csState === "ready";

  // One-time protocol initialization — only works when PDA has 0 lamports ("clean" state)
  async function initializeProtocol() {
    if (!publicKey) return;
    setInit(true); setInitErr(null);
    try {
      const { PLACEHOLDER_PROGRAM_ID } = await import("@workspace/d3fault-shared");
      const { Transaction, SystemProgram, PublicKey: SPK, TransactionInstruction } = await import("@solana/web3.js");
      const pid = new SPK(PLACEHOLDER_PROGRAM_ID);
      const [csPda] = SPK.findProgramAddressSync([Buffer.from("commitment_store")], pid);
      const initDisc = new Uint8Array([0xaf, 0xaf, 0x6d, 0x1f, 0x0d, 0x98, 0x9b, 0xed]);
      const tx = new Transaction();
      tx.add(new TransactionInstruction({
        programId: pid,
        keys: [
          { pubkey: csPda,                   isSigner: false, isWritable: true },
          { pubkey: publicKey,               isSigner: true,  isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(initDisc),
      }));
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash; tx.feePayer = publicKey;
      const w = wallets.find(wl => wl.address === publicKey.toBase58()) ?? wallets[0];
      if (!w) throw new Error("No wallet");
      const { signedTransaction } = await signTransaction({ transaction: tx.serialize({ requireAllSignatures: false }), wallet: w });
      const sig = await connection.sendRawTransaction(signedTransaction);
      await connection.confirmTransaction(sig, "confirmed");
      // Success — refresh server-side state
      void refetchProgramInfo();
    } catch (e) {
      const logs: string[] | undefined = (e as { logs?: string[] }).logs;
      const msg = e instanceof Error ? e.message : "Initialization failed";
      const detail = logs?.slice(-4).join(" | ") ?? msg.split("\n")[0];
      setInitErr(detail);
      // If the error is the 10,240-byte allocate/realloc CPI limit, mark as permanently blocked
      const isPermBlocked = detail.includes("realloc") || detail.includes("reallocate") ||
        detail.includes("10240") || detail.includes("allocat") || detail.includes("Account data size");
      if (isPermBlocked) setCsInitFailed(true);
    } finally { setInit(false); }
  }

  function generate() {
    const secret = generateSecret();
    const hex = toHex(secret);
    setLink("#" + hex);
    setStep(2);
  }

  async function deposit() {
    if (!publicKey || !link || !amount) return;
    setDepositing(true); setDepositErr(null);
    try {
      const { PLACEHOLDER_PROGRAM_ID } = await import("@workspace/d3fault-shared");
      const hexPart = link.startsWith("#") ? link.slice(1) : link;
      const secret  = new Uint8Array(hexPart.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
      const commitment = await computeCommitment(secret);
      const { Transaction, SystemProgram, PublicKey: SPK, LAMPORTS_PER_SOL: LAMPS, TransactionInstruction } = await import("@solana/web3.js");
      const pid    = new SPK(PLACEHOLDER_PROGRAM_ID);
      const [csPda] = SPK.findProgramAddressSync([Buffer.from("commitment_store")], pid);
      const exp_   = BigInt(Math.floor(Date.now() / 1000) + expiry);
      const data   = new Uint8Array(56);
      const dv     = new DataView(data.buffer);

      const tx = new Transaction();

      if (isSolSend) {
        // ── deposit_sol: disc = sha256("global:deposit_sol")[0:8]
        const disc = new Uint8Array([0x6c, 0x51, 0x4e, 0x75, 0x7d, 0x9b, 0x38, 0xc8]);
        const lamps = BigInt(Math.round(parseFloat(amount) * LAMPS));
        // Protocol fee: 0.25% of deposit, sent to relayer wallet in same tx
        const feeLamps = lamps * BigInt(PROTOCOL_FEE_BPS) / 10000n;
        data.set(disc, 0); data.set(commitment, 8);
        dv.setBigUint64(40, lamps, true);
        dv.setBigInt64(48, exp_, true);
        // Fee transfer first (so user sees it clearly in explorer)
        tx.add(new TransactionInstruction({
          programId: SystemProgram.programId,
          keys: [
            { pubkey: publicKey,          isSigner: true,  isWritable: true  },
            { pubkey: RELAYER_FEE_PUBKEY, isSigner: false, isWritable: true  },
          ],
          data: (() => {
            const d = Buffer.alloc(12); d.writeUInt32LE(2, 0); d.writeBigInt64LE(feeLamps, 4); return d;
          })(),
        }));
        tx.add(new TransactionInstruction({
          programId: pid,
          keys: [
            { pubkey: csPda,                   isSigner: false, isWritable: true  },
            { pubkey: publicKey,               isSigner: true,  isWritable: true  },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data: Buffer.from(data),
        }));
      } else {
        // ── deposit_spl: disc = sha256("global:deposit_spl")[0:8]
        const disc    = new Uint8Array([0xe0, 0x00, 0xc6, 0xaf, 0xc6, 0x2f, 0x69, 0xcc]);
        const mintPK  = new SPK(sendMint);
        const rawAmt  = BigInt(Math.round(parseFloat(amount) * Math.pow(10, sendDec)));
        // Flat 0.0021 SOL fee for SPL deposits — covers worst-case relayer
        // cost on claim: ~0.00204 SOL ATA rent (if recipient has no ATA) +
        // 0.000005 SOL tx fee. Break-even with a tiny safety margin; will
        // bump up post-launch.
        const splFeeLamps = 2_100_000n;
        data.set(disc, 0); data.set(commitment, 8);
        dv.setBigUint64(40, rawAmt, true);
        dv.setBigInt64(48, exp_, true);
        const depositorAta = getAta(mintPK, publicKey);
        const escrowAta    = getAta(mintPK, csPda);
        // Fee transfer
        tx.add(new TransactionInstruction({
          programId: SystemProgram.programId,
          keys: [
            { pubkey: publicKey,          isSigner: true,  isWritable: true  },
            { pubkey: RELAYER_FEE_PUBKEY, isSigner: false, isWritable: true  },
          ],
          data: (() => {
            const d = Buffer.alloc(12); d.writeUInt32LE(2, 0); d.writeBigInt64LE(splFeeLamps, 4); return d;
          })(),
        }));
        tx.add(new TransactionInstruction({
          programId: pid,
          keys: [
            { pubkey: csPda,            isSigner: false, isWritable: true  },
            { pubkey: publicKey,        isSigner: true,  isWritable: true  },
            { pubkey: mintPK,           isSigner: false, isWritable: false },
            { pubkey: depositorAta,     isSigner: false, isWritable: true  },
            { pubkey: escrowAta,        isSigner: false, isWritable: true  },
            { pubkey: TOKEN_PROG,       isSigner: false, isWritable: false },
            { pubkey: ASSOC_PROG,       isSigner: false, isWritable: false },
            { pubkey: SYS_PROG,        isSigner: false, isWritable: false },
          ],
          data: Buffer.from(data),
        }));
      }

      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash; tx.feePayer = publicKey;
      const w = wallets.find(wl => wl.address === publicKey.toBase58()) ?? wallets[0];
      if (!w) throw new Error("No wallet");
      const { signedTransaction } = await signTransaction({ transaction: tx.serialize({ requireAllSignatures: false }), wallet: w });
      const sig = await connection.sendRawTransaction(signedTransaction);
      await connection.confirmTransaction(sig, "confirmed");
      onDeposited(); setStep(3);
    } catch (e) {
      const logs: string[] | undefined = (e as { logs?: string[] }).logs;
      const logSuffix = logs?.length ? "\n\nLogs:\n" + logs.slice(-6).join("\n") : "";
      setDepositErr((e instanceof Error ? e.message : "Deposit failed") + logSuffix);
    }
    finally { setDepositing(false); }
  }

  function copyLink() { void navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  function reset() { setStep(1); setLink(""); setAmount(""); setDepositErr(null); setCopied(false); setSendMint(SOL_SENTINEL); setSendDec(9); }

  return (
    <motion.div
      style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 540, margin: "0 auto" }}>

      <SectionHeader
        eyebrow="Send"
        title="Send funds"
        description="Issue a private claim link backed by escrow, or run a standard on-chain transfer."
        icon={<Send style={{ width: 16, height: 16 }} />}
      />

      {/* ── Mode toggle: Private (escrow) vs Direct (regular send) ──────────── */}
      <div style={{ ...PANEL, padding: 4, borderRadius: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, background: "rgba(0,0,0,0.3)" }}>
        {[
          { v: "private", label: "Private Send", icon: Shield,    sub: "D3FAULT Private" },
          { v: "direct",  label: "Direct Send",  icon: Send,      sub: "Standard transfer" },
        ].map(({ v, label, icon: Icon, sub }) => {
          const active = mode === v;
          return (
            <button key={v} onClick={() => setMode(v as "private" | "direct")}
              style={{ padding: "9px 12px", borderRadius: 9, border: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                color: active ? "#fff" : "rgba(255,255,255,0.32)",
                background: active ? "linear-gradient(160deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.06) 100%)" : "transparent",
                boxShadow: active ? "0 1px 0 rgba(255,255,255,0.12) inset, 0 2px 8px rgba(0,0,0,0.25)" : "none",
                transition: "all 0.15s ease",
              }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: active ? 700 : 500 }}>
                <Icon style={{ width: 13, height: 13, opacity: active ? 1 : 0.5 }} />
                <span>{label}</span>
              </div>
              <span style={{ fontSize: 9, color: active ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.22)", letterSpacing: "0.04em", fontFamily: "monospace" }}>{sub}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════ DIRECT SEND MODE ═══════════════════ */}
      {mode === "direct" && (
        <Card>
          <CardHead>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Send style={{ width: 13, height: 13, color: C.faint }} />
              <FieldLabel>Direct Send</FieldLabel>
            </div>
            <span style={{ fontSize: 10, color: C.dimmed, fontWeight: 600, letterSpacing: "0.06em" }}>STANDARD TRANSFER</span>
          </CardHead>
          <div style={{ padding: "22px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 11, color: C.faint, margin: 0, lineHeight: 1.7, fontFamily: "monospace" }}>
              Standard on-chain transfer — fast, regular network fees only. Tx is publicly linked from sender to recipient. For privacy, use Private Send instead.
            </p>

            {/* Source wallet selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <FieldLabel>From</FieldLabel>
              <div style={{ display: "grid", gridTemplateColumns: hasBrowser ? "1fr 1fr" : "1fr", gap: 6, padding: 4, background: "rgba(0,0,0,0.35)", border: `1px solid ${C.border}`, borderRadius: 10 }}>
                {[
                  { v: "privy",   label: "Connected", badge: "PRIVY", addr: publicKey?.toBase58() ?? null, dot: "rgba(160,255,160,0.8)" },
                  ...(hasBrowser ? [{ v: "browser", label: "Browser", badge: "LOCAL", addr: browserWallet!.publicKey, dot: "rgba(140,180,255,0.8)" }] : []),
                ].map(opt => {
                  const active = dirSource === opt.v;
                  return (
                    <button key={opt.v} onClick={() => setDirSource(opt.v as "privy" | "browser")}
                      style={{ padding: "9px 10px", borderRadius: 7, border: 0, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                        color: active ? C.text : C.muted,
                        background: active ? "rgba(255,255,255,0.10)" : "transparent",
                        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                      }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: active ? 700 : 500 }}>
                        <StatusDot color={opt.dot} />
                        <span>{opt.label}</span>
                        <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: C.dimmed, background: "rgba(255,255,255,0.06)", padding: "2px 5px", borderRadius: 3 }}>{opt.badge}</span>
                      </div>
                      <span style={{ fontSize: 9, color: C.dimmed, fontFamily: "monospace" }}>
                        {opt.addr ? `${opt.addr.slice(0, 4)}…${opt.addr.slice(-4)}` : <ContextChip label="NO ADDR" tone="warn" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Token */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <FieldLabel>Token</FieldLabel>
              <JupiterTokenPicker
                value={dirMint}
                onChange={(mint, dec) => { setDirMint(mint); setDirDec(dec); }}
                knownList={PRIVATE_TOKENS}
                fullWidth
              />
            </div>

            {/* Recipient */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <FieldLabel>Recipient Address</FieldLabel>
              <input
                style={{ ...INPUT_STYLE, fontSize: 12, fontFamily: "'JetBrains Mono', ui-monospace, monospace", borderColor: dirRecipient && !isValidRecipient(dirRecipient) ? "rgba(220,80,80,0.4)" : C.border }}
                placeholder="Solana wallet address"
                value={dirRecipient} onChange={e => setDirRecipient(e.target.value.trim())}
                data-testid="input-direct-recipient"
              />
            </div>

            {/* Amount + balance */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <FieldLabel>Amount ({dirToken.symbol})</FieldLabel>
                <button onClick={setDirMax} disabled={dirBalance === null}
                  style={{ background: "transparent", border: "none", cursor: dirBalance === null ? "not-allowed" : "pointer", fontSize: 10, fontWeight: 700, color: dirBalance === null ? C.dimmed : C.muted, letterSpacing: "0.08em", fontFamily: "'Space Grotesk', 'Inter', sans-serif", padding: 0 }}>
                  MAX
                </button>
              </div>
              <input
                style={{ ...INPUT_STYLE, fontSize: 20, fontFamily: "monospace", fontWeight: 500 }}
                placeholder="0.00" type="number" min="0" step="0.000001"
                value={dirAmount} onChange={e => setDirAmount(e.target.value)}
                data-testid="input-direct-amount"
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, fontFamily: "monospace", color: C.dimmed, paddingTop: 2 }}>
                <span>Balance</span>
                <span style={{ color: C.faint }}>{dirBalance !== null ? `${dirBalance.toFixed(dirDec <= 6 ? 6 : 9)} ${dirToken.symbol}` : <Skeleton w={70} h={9} />}</span>
              </div>
            </div>

            {/* Inline fee-reserve warning for SPL sends without enough SOL */}
            {!dirIsSol && dirSourceAddress && dirSolBal !== null && !dirHasFeeSol && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(255,180,0,0.05)", border: "1px solid rgba(255,180,0,0.2)", borderRadius: 10, padding: "10px 12px" }}>
                <AlertTriangle style={{ width: 13, height: 13, color: "rgba(255,200,80,0.8)", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11, color: "rgba(255,210,140,0.9)", margin: 0, lineHeight: 1.55, fontFamily: "monospace" }}>
                  This wallet needs ~{SOL_FEE_RESERVE_SPL} SOL for network fees and recipient account rent. Current SOL: {dirSolBal.toFixed(6)}.
                </p>
              </div>
            )}

            {dirErr && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(220,60,60,0.07)", border: "1px solid rgba(220,60,60,0.22)", borderRadius: 10, padding: "10px 12px" }}>
                <AlertTriangle style={{ width: 13, height: 13, color: "rgba(220,100,100,0.8)", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 11, color: "rgba(220,120,120,0.9)", margin: 0, lineHeight: 1.55, fontFamily: "monospace", wordBreak: "break-word" }}>{dirErr}</p>
              </div>
            )}

            {dirSig && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(120,220,120,0.05)", border: "1px solid rgba(120,220,120,0.2)", borderRadius: 10, padding: "10px 12px" }}>
                <CheckCircle2 style={{ width: 13, height: 13, color: "rgba(120,220,120,0.85)", flexShrink: 0, marginTop: 1 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(180,240,180,0.95)", marginBottom: 3 }}>Sent successfully</div>
                  <a href={`https://solscan.io/tx/${dirSig}${EXPLORER_CLUSTER}`} target="_blank" rel="noreferrer"
                    style={{ fontSize: 10, color: C.muted, fontFamily: "monospace", wordBreak: "break-all", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {dirSig.slice(0, 16)}…{dirSig.slice(-12)} <ExternalLink style={{ width: 10, height: 10 }} />
                  </a>
                </div>
              </div>
            )}

            <motion.button whileHover={{ scale: dirCanSend ? 1.01 : 1 }} whileTap={{ scale: dirCanSend ? 0.99 : 1 }}
              onClick={() => void executeDirectSend()} disabled={!dirCanSend}
              className="d3-btn-primary" style={{ ...BTN_PRIMARY, opacity: dirCanSend ? 1 : 0.38 }} data-testid="button-direct-send">
              {dirBusy ? <><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> Sending…</> : <><Send style={{ width: 14, height: 14 }} /> Send {dirAmountNum > 0 ? `${dirAmountNum} ${dirToken.symbol}` : ""}</>}
            </motion.button>
          </div>
        </Card>
      )}

      {/* ═══════════════════ PRIVATE SEND MODE ═══════════════════ */}
      {mode === "private" && (<>

      {/* ── Protocol setup panel — shown when store not ready and not bypassed ── */}
      {!csForced && csState !== "ready" && csState !== null && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          style={{ ...PANEL, borderRadius: 14, padding: "18px 20px", border: `1px solid ${csState === "stuck" ? "rgba(220,60,60,0.25)" : "rgba(255,140,0,0.2)"}`, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* ── STUCK STATE: PDA exists but is system-owned (corrupted state) ── */}
          {csState === "stuck" && (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(220,60,60,0.08)", border: "1px solid rgba(220,60,60,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <AlertTriangle style={{ width: 14, height: 14, color: "rgba(220,80,80,0.8)" }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6 }}>Protocol Store Corrupted</div>
                  <p style={{ fontSize: 11, color: C.faint, margin: 0, lineHeight: 1.7 }}>
                    The CommitmentStore PDA exists on-chain but is owned by the System Program rather than the D3FAULT program. This is an unrecoverable state — the deployer must close the account and re-initialize the protocol.
                  </p>
                </div>
              </div>
              <div style={{ background: "rgba(220,60,60,0.06)", border: "1px solid rgba(220,60,60,0.15)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(220,100,100,0.7)", letterSpacing: "0.08em", marginBottom: 2 }}>RECOVERY STEPS (DEPLOYER ONLY)</div>
                <div style={{ fontSize: 11, color: C.faint, lineHeight: 1.65 }}>
                  <strong style={{ color: C.muted }}>1. </strong>Close the orphaned PDA account to reclaim rent.<br />
                  <strong style={{ color: C.muted }}>2. </strong>Run <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 4px", borderRadius: 3 }}>init-store-raw.ts</code> to re-initialize the CommitmentStore.<br />
                  <strong style={{ color: "rgba(100,220,100,0.7)" }}>3. </strong>Reload this page — the protocol will be ready once the PDA is program-owned.
                </div>
              </div>
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                onClick={() => setCsForced(true)}
                className="d3-btn-primary" style={{ ...BTN_PRIMARY, background: "rgba(255,255,255,0.04)", color: C.muted, border: "1px solid rgba(255,255,255,0.1)", fontSize: 11 }}>
                Continue in Test Mode (UI flow only — on-chain calls will fail)
              </motion.button>
            </>
          )}

          {/* ── CLEAN STATE: normal uninitialized, deployer can init ── */}
          {csState === "clean" && (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: "rgba(255,140,0,0.08)", border: "1px solid rgba(255,140,0,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Shield style={{ width: 14, height: 14, color: "rgba(255,140,0,0.7)" }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 4 }}>Protocol Setup Required</div>
                  <p style={{ fontSize: 11, color: C.faint, margin: 0, lineHeight: 1.65 }}>
                    The escrow contract hasn't been initialized yet. This is a <strong style={{ color: C.muted }}>one-time step done by the deployer</strong> (~0.20 SOL rent deposit). After init, users only pay their deposit amount + a tiny network fee (~0.000005 SOL).
                  </p>
                </div>
              </div>
              {initErr && (
                <div style={{ fontSize: 11, color: "rgba(220,120,120,0.9)", fontFamily: "monospace", background: "rgba(220,60,60,0.07)", border: "1px solid rgba(220,60,60,0.2)", borderRadius: 8, padding: "8px 12px" }}>
                  {initErr}
                </div>
              )}
              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => void initializeProtocol()}
                disabled={initializing || !publicKey}
                className="d3-btn-primary" style={{ ...BTN_PRIMARY, opacity: (initializing || !publicKey) ? 0.5 : 1, background: "rgba(255,140,0,0.12)", color: "rgba(255,160,40,0.95)", border: "1px solid rgba(255,140,0,0.25)" }}>
                {initializing
                  ? <><Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Initializing…</>
                  : "Initialize Protocol (one-time)"}
              </motion.button>
            </>
          )}
        </motion.div>
      )}

      {/* ── Test mode banner ── */}
      {csForced && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: "rgba(255,200,0,0.04)", border: "1px solid rgba(255,200,0,0.12)", borderRadius: 10 }}>
          <AlertTriangle style={{ width: 12, height: 12, color: "rgba(255,200,0,0.5)", flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: "rgba(255,200,0,0.5)", fontWeight: 600, letterSpacing: "0.05em" }}>TEST MODE — UI flow only. On-chain calls are disabled.</span>
        </div>
      )}

      <Card>
        <CardHead>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Shield style={{ width: 14, height: 14, color: csReady === null ? C.dimmed : csReady ? C.faint : "rgba(255,140,0,0.5)" }} />
            <FieldLabel>Private Escrow Transfer</FieldLabel>
            {csReady === null && <Loader2 style={{ width: 11, height: 11, color: C.dimmed, animation: "spin 1s linear infinite" }} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {[1,2,3].map(n => (
              <div key={n} style={{ width: n === step ? 18 : 6, height: 6, borderRadius: 3, background: n === step ? C.muted : n < step ? "rgba(120,220,120,0.5)" : C.dimmed, transition: "all 0.3s" }} />
            ))}
          </div>
        </CardHead>

        <div style={{ padding: "24px 20px" }}>
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }}
                style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <p style={{ fontSize: 12, color: C.faint, lineHeight: 1.7, margin: 0, fontWeight: 400 }}>
                  Deposit SOL or any SPL token into the escrow. A one-time claim secret is generated client-side — never leaves your browser. Anyone with the secret can claim to any wallet, anonymously.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <FieldLabel>Token</FieldLabel>
                  <JupiterTokenPicker
                    value={sendMint}
                    onChange={(mint, dec) => { setSendMint(mint); setSendDec(dec); }}
                    knownList={PRIVATE_TOKENS}
                    fullWidth
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <FieldLabel>Amount ({sendToken.symbol})</FieldLabel>
                  <input style={{ ...INPUT_STYLE, fontSize: 20, fontFamily: "monospace", fontWeight: 500, opacity: csReady === false ? 0.4 : 1 }} placeholder="0.10" type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} disabled={csReady === false} data-testid="input-transfer-amount" />
                  <PrivateSendBalanceLine
                    publicKey={publicKey}
                    mint={isSolSend ? SOL_MINT : sendMint}
                    isSol={isSolSend}
                    symbol={sendToken.symbol}
                    decimals={sendDec}
                    onMax={(b) => setAmount(b)}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, fontFamily: "monospace", color: C.dimmed, background: "rgba(0,0,0,0.2)", border: DIVIDER, borderRadius: 8, padding: "8px 12px" }}>
                  <span>Protocol fee</span>
                  <span style={{ color: C.faint }}>{isSolSend ? "0.25% of deposit" : "0.0021 SOL flat"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <FieldLabel>Link Expiry</FieldLabel>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                    {EXPIRY_PRESETS.map(p => (
                      <button key={p.label} onClick={() => setExpiry(p.seconds)} disabled={csReady === false}
                        style={{ height: 40, borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: csReady === false ? "not-allowed" : "pointer", transition: "all 0.15s", border: "1px solid",
                          opacity: csReady === false ? 0.35 : 1,
                          ...(expiry === p.seconds
                            ? { background: "#fff", color: "#000", borderColor: "#fff", boxShadow: "0 0 0 1px rgba(255,255,255,0.4), 0 2px 12px rgba(255,255,255,0.12)" }
                            : { ...PANEL_SM, color: C.faint, borderColor: C.border })
                        }}
                        data-testid={`button-expiry-${p.label}`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={generate} disabled={!amount || csReady === false}
                  className="d3-btn-primary" style={{ ...BTN_PRIMARY, opacity: (!amount || csReady === false) ? 0.38 : 1 }} data-testid="button-generate-commitment">
                  Generate Claim Link
                </motion.button>
              </motion.div>
            )}

            {(step === 2 || step === 3) && (
              <motion.div key="step23" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.25 }}
                style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {step === 3 ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "12px 0" }}>
                    <div style={{ ...PANEL, width: 60, height: 60, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid rgba(120,220,120,0.3)` }}>
                      <CheckCircle2 style={{ width: 28, height: 28, color: "rgba(120,220,120,0.8)" }} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>Transfer Ready</div>
                      <div style={{ fontSize: 12, color: C.faint, marginTop: 6, lineHeight: 1.6 }}>Share the link below. Recipient can claim to any wallet.</div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* static save-link warning */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "rgba(255,200,0,0.05)", border: "1px solid rgba(255,200,0,0.15)", borderRadius: 10, padding: "12px 14px" }}>
                      <AlertTriangle style={{ width: 14, height: 14, color: "rgba(255,200,0,0.6)", flexShrink: 0, marginTop: 1 }} />
                      <p style={{ fontSize: 11, color: "rgba(255,200,0,0.6)", margin: 0, lineHeight: 1.6, fontFamily: "monospace" }}>
                        {depositing ? "Submitting deposit…" : "Save the link before depositing. It cannot be recovered if lost."}
                      </p>
                    </div>
                    {/* error box — shown separately so it never covers the buttons */}
                    {depositErr && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "rgba(220,60,60,0.07)", border: "1px solid rgba(220,60,60,0.22)", borderRadius: 10, padding: "12px 14px" }}>
                        <AlertTriangle style={{ width: 13, height: 13, color: "rgba(220,100,100,0.8)", flexShrink: 0, marginTop: 1 }} />
                        <p style={{ fontSize: 11, color: "rgba(220,120,120,0.9)", margin: 0, lineHeight: 1.65, fontFamily: "monospace", wordBreak: "break-word" }}>
                          {depositErr.split("\n\nLogs:")[0]}
                        </p>
                      </div>
                    )}
                  </>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <FieldLabel>Claim Secret</FieldLabel>
                  <div style={{ display: "flex", gap: 0 }}>
                    <input style={{ ...INPUT_STYLE, flex: 1, fontSize: 11, fontFamily: "monospace", color: C.faint, borderRadius: "10px 0 0 10px", borderRight: "none" }} value={link} readOnly data-testid="input-claim-link" />
                    <button onClick={copyLink} data-testid="button-copy-claim-link"
                      style={{ ...PANEL_SM, height: 44, width: 44, borderRadius: "0 10px 10px 0", border: `1px solid ${C.border}`, borderLeft: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: copied ? "rgba(120,220,120,0.8)" : C.faint }}>
                      {copied ? <CheckCircle2 style={{ width: 14, height: 14 }} /> : <Copy style={{ width: 14, height: 14 }} />}
                    </button>
                  </div>
                  <p style={{ fontSize: 10, color: C.dimmed, margin: 0, lineHeight: 1.55, fontFamily: "monospace" }}>
                    Anyone with this secret can claim the funds. Send only through a secure channel. No domain needed — paste directly into the Receive tab.
                  </p>
                </div>

                {step === 2 && (
                  <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => void deposit()} disabled={depositing || !publicKey}
                    className="d3-btn-primary" style={{ ...BTN_PRIMARY, opacity: (depositing || !publicKey) ? 0.38 : 1 }} data-testid="button-deposit">
                    {depositing ? <><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> Depositing…</> : "Confirm & Deposit"}
                  </motion.button>
                )}
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.97 }} onClick={reset}
                  className="d3-btn-ghost" style={BTN_GHOST} data-testid="button-new-transfer">
                  New Transfer
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
      </>)}
    </motion.div>
  );
}

// Tiny helper rendered under the Private Send amount input — shows current
// balance of the selected token for the connected (Privy) wallet, with a MAX
// shortcut that respects a small SOL gas reserve.
function PrivateSendBalanceLine({ publicKey, mint, isSol, symbol, decimals, onMax }: {
  publicKey: PublicKey | null; mint: string; isSol: boolean; symbol: string; decimals: number;
  onMax: (b: string) => void;
}) {
  const addr = publicKey?.toBase58() ?? null;
  const { bal: solBal } = useSolBalance(isSol ? addr : null, 0);
  const { balance: splBal } = useTokenBalance(!isSol ? addr : null, mint, 0);
  const bal: number | null = isSol ? solBal : (splBal ?? null);
  function setMax() {
    if (bal === null) return;
    const reserve = isSol ? 0.012 : 0;
    const usable = Math.max(0, bal - reserve);
    onMax(usable.toFixed(decimals <= 6 ? 6 : 9));
  }
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, fontFamily: "monospace", color: C.dimmed, paddingTop: 2 }}>
      <span>Balance</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: C.faint }}>{bal !== null ? `${bal.toFixed(decimals <= 6 ? 6 : 9)} ${symbol}` : <Skeleton w={70} h={9} />}</span>
        <button onClick={setMax} disabled={bal === null}
          style={{ background: "transparent", border: "none", cursor: bal === null ? "not-allowed" : "pointer", fontSize: 9, fontWeight: 700, color: bal === null ? C.dimmed : C.muted, letterSpacing: "0.08em", fontFamily: "'Space Grotesk', 'Inter', sans-serif", padding: 0 }}>
          MAX
        </button>
      </div>
    </div>
  );
}

// ─── PortfolioView ────────────────────────────────────────────────────────────
function timeAgo(unix: number): string {
  const s = Math.floor(Date.now() / 1000) - unix;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function PortfolioView({ publicKey, refresh }: { publicKey: PublicKey | null; refresh: number }) {
  const { solBalance, tokens, loading } = useWalletBalances(publicKey, refresh);
  const activity = useWalletActivity7d(publicKey, refresh);
  const [, setJupReady] = useState(0);
  useEffect(() => {
    const unknown = tokens
      .map(t => t.mint)
      .filter(m => !SWAP_TOKENS.find(k => k.mint === m) && !PRIVATE_TOKENS.find(k => k.mint === m) && !_jupCache.has(m));
    if (unknown.length === 0) return;
    let cancelled = false;
    Promise.all(unknown.map(m => resolveMintAsync(m))).then(() => {
      if (!cancelled) setJupReady(n => n + 1);
    });
    return () => { cancelled = true; };
  }, [tokens]);

  const allMints = [SOL_MINT, ...tokens.map(t => t.mint)];
  const { prices: priceMap } = useJupiterPrices(allMints);

  const solRow = priceMap.get(SOL_MINT);
  const solUsd = solBalance !== null && solRow?.usdPrice ? solBalance * solRow.usdPrice : null;
  const tableRows = [
    ...(solBalance !== null ? [{
      symbol: "SOL", name: "Solana", mint: SOL_MINT, uiAmount: solBalance,
      price: solRow?.usdPrice ?? null,
      usd: solUsd,
      change24h: solRow?.priceChange24h ?? null,
    }] : []),
    ...tokens.map(t => {
      const meta = resolveTokenMeta(t.mint);
      const row = priceMap.get(t.mint);
      const price = row?.usdPrice ?? null;
      return {
        symbol: meta.symbol, name: meta.name, mint: t.mint, uiAmount: t.uiAmount,
        price,
        usd: price !== null ? t.uiAmount * price : null,
        change24h: row?.priceChange24h ?? null,
      };
    }),
  ];

  // Aggregates
  const totalUsd = tableRows.reduce((sum, r) => sum + (r.usd ?? 0), 0);
  // USD-weighted 24h change across the whole portfolio
  const weighted24h = totalUsd > 0
    ? tableRows.reduce((sum, r) => sum + ((r.change24h ?? 0) * (r.usd ?? 0)), 0) / totalUsd
    : null;

  // Allocation breakdown — top 5 by USD value, rest grouped as "Others"
  const allocSorted = [...tableRows].filter(r => (r.usd ?? 0) > 0).sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0));
  const allocTop = allocSorted.slice(0, 5);
  const allocRestUsd = allocSorted.slice(5).reduce((s, r) => s + (r.usd ?? 0), 0);

  // Behaviour label from total tx in last 7d
  const behaviour =
    activity.totalTx === 0 ? "Dormant" :
    activity.totalTx < 10 ? "Quiet" :
    activity.totalTx < 40 ? "Active" :
    activity.totalTx < 100 ? "Very Active" : "Power User";

  function exportCsv(rows: typeof tableRows) {
    const hdr = "Symbol,Name,Mint,Balance,Price_USD,Value_USD,Change_24h\n";
    const lines = rows.map(r => `${r.symbol},${r.name},${r.mint},${r.uiAmount.toFixed(8)},${r.price?.toFixed(4) ?? ""},${r.usd?.toFixed(2) ?? ""},${r.change24h?.toFixed(2) ?? ""}`).join("\n");
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([hdr + lines], { type: "text/csv" })), download: `d3fault_${new Date().toISOString().split("T")[0]}.csv` });
    a.click();
  }

  const heads = ["Asset", "Price", "24h", "Balance", "Value (USD)"];
  const sparkMax = Math.max(1, ...activity.dailyCounts);
  const dayLabels = (() => {
    const out: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      out.push(d.toLocaleDateString(undefined, { weekday: "narrow" }));
    }
    return out;
  })();

  // Frosted "stat tile" used inside hero + activity card
  const STAT_TILE: React.CSSProperties = {
    ...PANEL_SM,
    borderRadius: 12,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  };

  const totalChangeColor =
    weighted24h === null ? C.dimmed
    : weighted24h >= 0 ? "rgba(120,220,120,0.92)" : "rgba(230,110,110,0.9)";

  return (
    <motion.div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      <SectionHeader
        eyebrow="Portfolio"
        title="Holdings overview"
        description="Aggregated value, recent on-chain activity and asset allocation across your connected wallet."
        icon={<Activity style={{ width: 16, height: 16 }} />}
        right={<ContextChip
          icon={<StatusDot color={loading ? "rgba(220,180,80,0.85)" : "rgba(160,255,160,0.8)"} />}
          label={loading ? "SYNCING" : "LIVE"}
          tone={loading ? "loading" : "muted"}
        />}
      />

      {/* ── Hero: Total Portfolio Value ─────────────────────────────────── */}
      <Card>
        <div style={{ padding: "26px 28px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 18 }}>
          <div>
            <div style={{ ...LABEL_STYLE, color: C.dimmed, marginBottom: 10 }}>Total Portfolio Value</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
              <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 42, fontWeight: 600, letterSpacing: "-0.02em", color: C.text, lineHeight: 1 }}>
                {loading && totalUsd <= 0
                  ? <Skeleton w={180} h={36} r={8} style={{ display: "inline-block", verticalAlign: "middle" }} />
                  : <CountUpUSD value={totalUsd} />}
              </div>
              {weighted24h !== null && (
                <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 600, color: totalChangeColor, letterSpacing: "0.02em" }}>
                  {weighted24h >= 0 ? "+" : ""}{weighted24h.toFixed(2)}% <span style={{ color: C.dimmed, fontWeight: 500 }}>24h</span>
                </div>
              )}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: C.faint, letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: 10 }}>
              <span>{tableRows.length} {tableRows.length === 1 ? "asset" : "assets"}</span>
              <span style={{ width: 3, height: 3, borderRadius: "50%", background: C.dimmed }} />
              <span>{activity.lastActivity ? `Last active ${timeAgo(activity.lastActivity)}` : "No recent activity"}</span>
            </div>
          </div>
          <div style={{ ...STAT_TILE, minWidth: 140, alignItems: "flex-end" }}>
            <div style={{ fontSize: 9, color: C.dimmed, letterSpacing: "0.1em", textTransform: "uppercase" }}>Wallet Profile</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>{behaviour}</div>
            <div style={{ fontSize: 10, color: C.faint }}>past 7 days</div>
          </div>
        </div>
      </Card>

      {/* ── Row: 7-Day Activity + Allocation ─────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 0.95fr)", gap: 14 }}>

        {/* 7-Day Activity */}
        <Card>
          <CardHead>
            <FieldLabel>7-Day Activity</FieldLabel>
            {activity.loading
              ? <ContextChip icon={<Loader2 style={{ width: 9, height: 9, animation: "spin 1s linear infinite" }} />} label="SYNCING" tone="loading" />
              : <ContextChip label="LAST 7 DAYS" />}
          </CardHead>
          <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 30, fontWeight: 600, color: C.text, letterSpacing: "-0.02em", lineHeight: 1 }}>{activity.totalTx}</div>
              <div style={{ fontSize: 11, color: C.faint, letterSpacing: "0.06em", textTransform: "uppercase" }}>transactions</div>
            </div>

            {/* Sparkline bars */}
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, alignItems: "end", height: 64 }}>
                {activity.dailyCounts.map((c, i) => {
                  const h = Math.max(4, Math.round((c / sparkMax) * 64));
                  const isToday = i === 6;
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: "100%",
                        height: h,
                        borderRadius: 4,
                        background: isToday
                          ? "linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.18))"
                          : "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0.06))",
                        border: `1px solid ${isToday ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}`,
                        transition: "height 0.4s cubic-bezier(0.22,1,0.36,1)",
                      }} />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginTop: 8 }}>
                {dayLabels.map((d, i) => (
                  <div key={i} style={{ textAlign: "center", fontSize: 9, color: C.dimmed, letterSpacing: "0.1em", textTransform: "uppercase" }}>{d}</div>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={STAT_TILE}>
                <div style={{ fontSize: 9, color: C.dimmed, letterSpacing: "0.1em", textTransform: "uppercase" }}>Avg / Day</div>
                <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 18, fontWeight: 600, color: C.text }}>{(activity.totalTx / 7).toFixed(1)}</div>
              </div>
              <div style={STAT_TILE}>
                <div style={{ fontSize: 9, color: C.dimmed, letterSpacing: "0.1em", textTransform: "uppercase" }}>Busiest Day</div>
                <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", fontSize: 18, fontWeight: 600, color: C.text }}>
                  {activity.busiestDay
                    ? `${activity.busiestDay.label} · ${activity.busiestDay.count}`
                    : (activity.loading ? <Skeleton w={70} h={16} /> : <span style={{ fontSize: 12, color: C.dimmed, fontWeight: 500 }}>No activity yet</span>)}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Allocation */}
        <Card>
          <CardHead>
            <FieldLabel>Allocation</FieldLabel>
            <span style={{ fontSize: 9, color: C.dimmed, letterSpacing: "0.1em", textTransform: "uppercase" }}>by value</span>
          </CardHead>
          <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
            {totalUsd <= 0 ? (
              loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[0,1,2,3].map(i => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <Skeleton w={50} h={11} /><Skeleton w={36} h={9} />
                      </div>
                      <Skeleton w="100%" h={6} r={4} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ ...PANEL_SM, borderRadius: 12, padding: "28px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: C.dimmed, fontSize: 12, letterSpacing: "0.04em" }}>
                  <div style={{ ...PANEL_SM, width: 38, height: 38, borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Activity style={{ width: 15, height: 15, color: C.faint }} />
                  </div>
                  <div style={{ color: C.muted, fontWeight: 600 }}>Nothing to allocate</div>
                  <div style={{ color: C.dimmed, textAlign: "center", maxWidth: 220, fontSize: 11, lineHeight: 1.55 }}>
                    Receive priced assets to see your allocation breakdown.
                  </div>
                </div>
              )
            ) : (
              <>
                {allocTop.map((r, idx) => {
                  const pct = ((r.usd ?? 0) / totalUsd) * 100;
                  return (
                    <div key={r.mint} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "monospace" }}>
                        <span style={{ fontSize: 12, color: C.muted, fontWeight: 600, letterSpacing: "0.04em" }}>{r.symbol}</span>
                        <span style={{ fontSize: 11, color: C.faint }}>{pct.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden", border: `1px solid ${C.dimmed}` }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(2, pct)}%` }}
                          transition={{ duration: 0.85, delay: 0.05 + idx * 0.06, ease: [0.22, 1, 0.36, 1] }}
                          style={{
                            height: "100%",
                            background: "linear-gradient(90deg, rgba(255,255,255,0.55), rgba(255,255,255,0.20))",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                {allocRestUsd > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "monospace" }}>
                      <span style={{ fontSize: 12, color: C.faint, fontWeight: 600, letterSpacing: "0.04em" }}>OTHERS</span>
                      <span style={{ fontSize: 11, color: C.faint }}>{((allocRestUsd / totalUsd) * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: "rgba(255,255,255,0.05)", overflow: "hidden", border: `1px solid ${C.dimmed}` }}>
                      <div style={{ width: `${(allocRestUsd / totalUsd) * 100}%`, height: "100%", background: "rgba(255,255,255,0.18)" }} />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* ── Asset Inventory ──────────────────────────────────────────────── */}
      <Card>
        <CardHead>
          <FieldLabel>Asset Inventory</FieldLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {loading
              ? <ContextChip icon={<Loader2 style={{ width: 9, height: 9, animation: "spin 1s linear infinite" }} />} label="SCANNING" tone="loading" />
              : tableRows.length > 0 && <ContextChip label={`${tableRows.length} ${tableRows.length === 1 ? "ASSET" : "ASSETS"}`} />}
            {tableRows.length > 0 && (
              <button onClick={() => exportCsv(tableRows)} data-testid="button-export-csv"
                style={{ ...PANEL_SM, padding: "6px 12px", border: `1px solid ${C.border}`, borderRadius: 8, cursor: "pointer", fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", color: C.muted, textTransform: "uppercase" }}>
                Export CSV
              </button>
            )}
          </div>
        </CardHead>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: DIVIDER }}>
                {heads.map((h, i) => (
                  <th key={h} style={{ padding: "11px 20px", fontSize: 10, fontWeight: 600, color: C.dimmed, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: i === 0 ? "left" : "right", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                loading ? (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                ) : (
                  <tr><td colSpan={5} style={{ padding: "44px 0" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, color: C.dimmed }}>
                      <div style={{ ...PANEL_SM, width: 44, height: 44, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Wallet style={{ width: 18, height: 18, color: C.faint }} />
                      </div>
                      <div style={{ textAlign: "center", lineHeight: 1.55 }}>
                        <div style={{ fontSize: 13, color: C.muted, fontWeight: 600 }}>No assets yet</div>
                        <div style={{ fontSize: 11, color: C.dimmed, marginTop: 3 }}>Receive SOL or any SPL token to populate this view.</div>
                      </div>
                    </div>
                  </td></tr>
                )
              ) : tableRows.map(row => (
                <tr key={row.mint} style={{ borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                  <td style={{ padding: "15px 20px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <TokenLogo mint={row.mint} symbol={row.symbol} size={36} />
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: C.muted }}>{row.symbol}</div>
                        <div style={{ fontSize: 11, color: C.dimmed, marginTop: 1 }}>{row.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "15px 20px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: C.faint }}>{row.price ? `$${row.price.toFixed(2)}` : <ContextChip label="UNPRICED" />}</td>
                  <td style={{ padding: "15px 20px", textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>
                    {row.change24h !== null
                      ? <span style={{ color: row.change24h > 0 ? "rgba(120,220,120,0.85)" : "rgba(230,110,110,0.85)" }}>{row.change24h > 0 ? "+" : ""}{row.change24h.toFixed(2)}%</span>
                      : <ContextChip label="N/A" />}
                  </td>
                  <td style={{ padding: "15px 20px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: C.faint }}>{row.uiAmount.toFixed(4)}</td>
                  <td style={{ padding: "15px 20px", textAlign: "right", fontFamily: "monospace", fontSize: 13, color: C.text, fontWeight: 600 }}>{row.usd ? `$${row.usd.toFixed(2)}` : <ContextChip label="UNPRICED" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}
