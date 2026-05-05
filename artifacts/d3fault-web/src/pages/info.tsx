import React, { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowRight, ArrowUpRight, Github, ExternalLink, Copy, Check, KeyRound, Send, Repeat, Link2, RotateCcw, Wallet, ShieldCheck, Zap, AlertCircle, BookOpen, HelpCircle, FileText, Hash } from "lucide-react";
import { GrainOverlay } from "@/components/GrainOverlay";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ── Scroll progress bar (premium top accent) ─────────────────────── */
function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });
  return (
    <motion.div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 2, zIndex: 60,
        background: "linear-gradient(to right, rgba(255,255,255,0.85), rgba(255,255,255,0.4))",
        transformOrigin: "0% 50%", scaleX,
        boxShadow: "0 0 12px rgba(255,255,255,0.35)",
      }}
    />
  );
}

/* ── Reveal wrapper — scroll-tied fade-up with stagger support ────── */
function Reveal({
  children, delay = 0, y = 24, once = true,
}: { children: React.ReactNode; delay?: number; y?: number; once?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-80px" }}
      transition={{ duration: 0.7, ease, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ── Shared wrap ──────────────────────────────────────────────────── */
function Wrap({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={`d3-wrap${className ? " " + className : ""}`} style={{
      maxWidth: 1400, width: "100%", marginLeft: "auto", marginRight: "auto",
      paddingLeft: "clamp(24px, 5vw, 80px)", paddingRight: "clamp(24px, 5vw, 80px)",
      ...style,
    }}>{children}</div>
  );
}

/* ── X icon ───────────────────────────────────────────────────────── */
const XIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/* ── Static premium nav (info pages share this) ───────────────────── */
function InfoNav({ active }: { active: "docs" | "protocol" | "security" }) {
  const items: Array<{ key: typeof active; label: string; href: string }> = [
    { key: "docs", label: "Docs", href: "/docs" },
    { key: "protocol", label: "Protocol", href: "/protocol" },
    { key: "security", label: "Security", href: "/security" },
  ];

  return (
    <motion.nav
      initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease }}
      style={{ position: "fixed", top: 0, width: "100%", zIndex: 50 }}
    >
      <Wrap>
        <div style={{ paddingTop: 18, paddingBottom: 18 }}>
          <div style={{
            position: "relative", overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "space-between", height: 48,
            background: "rgba(10,10,14,0.72)", border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 18, paddingLeft: 18, paddingRight: 18,
            backdropFilter: "blur(18px) saturate(140%)", WebkitBackdropFilter: "blur(18px) saturate(140%)" as any,
            boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 36px rgba(0,0,0,0.35)",
          }}>
            <Link href="/">
              <div style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer" }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, overflow: "hidden", filter: "drop-shadow(0 0 14px rgba(255,255,255,0.2))", flexShrink: 0 }}>
                  <img src={`${import.meta.env.BASE_URL}logo.png`} alt="D3FAULT"
                    style={{ width: "140%", height: "140%", objectFit: "cover", marginLeft: "-20%", marginTop: "-20%" }} />
                </div>
                <span style={{ color: "white", fontWeight: 600, fontSize: 15, letterSpacing: "-0.02em" }}>D3FAULT</span>
              </div>
            </Link>

            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div className="d3-info-nav-links" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {items.map(it => (
                <Link key={it.key} href={it.href}
                  style={{
                    padding: "8px 14px", fontSize: 14,
                    color: it.key === active ? "white" : "rgba(255,255,255,0.4)",
                    fontWeight: 500, textDecoration: "none", transition: "color 0.2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = "white")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = it.key === active ? "white" : "rgba(255,255,255,0.4)")}
                >{it.label}</Link>
              ))}
              </div>
              <Link href="/app">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  style={{ marginLeft: 12, background: "white", color: "black", padding: "8px 16px", fontSize: 14, fontWeight: 600, borderRadius: 12, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  Launch App <ArrowRight style={{ width: 14, height: 14 }} />
                </motion.button>
              </Link>
            </div>
          </div>
        </div>
      </Wrap>
    </motion.nav>
  );
}

/* ── Compact footer ───────────────────────────────────────────────── */
function InfoFooter() {
  return (
    <footer style={{ position: "relative", paddingTop: 80, paddingBottom: 40 }}>
      <Wrap>
        <div style={{
          borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(12,12,16,0.6)", padding: "28px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 26, height: 26, borderRadius: 7, overflow: "hidden", flexShrink: 0, filter: "drop-shadow(0 0 10px rgba(255,255,255,0.16))" }}>
              <img src={`${import.meta.env.BASE_URL}logo.png`} alt="D3FAULT"
                style={{ width: "140%", height: "140%", objectFit: "cover", marginLeft: "-20%", marginTop: "-20%" }} />
            </div>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: "-0.005em" }}>
              &copy; {new Date().getFullYear()} D3FAULT Protocol · Open-source MIT
            </span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 16 }}>
            <a href="https://x.com/d3fault_sh" target="_blank" rel="noreferrer" aria-label="X"
              style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = "white")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>
              <XIcon size={15} />
            </a>
            <a href="#" target="_blank" rel="noreferrer" aria-label="GitHub"
              style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget.style.color = "white")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.5)")}>
              <Github style={{ width: 15, height: 15 }} />
            </a>
          </div>
        </div>
      </Wrap>
    </footer>
  );
}

/* ── Page hero (shared) — with subtle scroll-tied parallax ────────── */
function PageHero({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub: string }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 400], [0, -60]);
  const opacity = useTransform(scrollY, [0, 320], [1, 0.35]);

  return (
    <section className="d3-page-hero" style={{ position: "relative", paddingTop: 160, paddingBottom: 60 }}>
      <Wrap>
        <motion.div style={{ y, opacity }}>
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease, delay: 0.05 }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)", marginBottom: 22,
            }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "white", boxShadow: "0 0 8px rgba(255,255,255,0.7)" }} />
            <span style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{eyebrow}</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease, delay: 0.1 }}
            style={{ fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 700, color: "white", letterSpacing: "-0.04em", lineHeight: 1, margin: "0 0 22px 0" }}>
            {title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease, delay: 0.2 }}
            style={{ fontSize: "clamp(15px, 1.6vw, 18px)", color: "rgba(255,255,255,0.5)", fontWeight: 400, lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
            {sub}
          </motion.p>
        </motion.div>
      </Wrap>
    </section>
  );
}

/* ── Section title — fades up when scrolled into view ─────────────── */
function SectionTitle({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, ease }}
      style={{ marginBottom: 40, maxWidth: 720 }}>
      <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 12 }}>{eyebrow}</span>
      <h2 style={{ fontSize: "clamp(26px, 3.2vw, 36px)", fontWeight: 700, color: "white", letterSpacing: "-0.03em", lineHeight: 1.15, margin: "0 0 12px 0" }}>{title}</h2>
      {sub && <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.45)", fontWeight: 400, lineHeight: 1.65, margin: 0 }}>{sub}</p>}
    </motion.div>
  );
}

/* ── Stagger grid — children fade-up one-by-one on scroll ─────────── */
function StaggerGrid({ children, columns = "repeat(auto-fit, minmax(260px, 1fr))", gap = 12, className }: { children: React.ReactNode; columns?: string; gap?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }}
      style={{ display: "grid", gridTemplateColumns: columns, gap }}
    >
      {children}
    </motion.div>
  );
}

const staggerItem = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

/* ── Generic premium card — animates via staggerItem when inside StaggerGrid */
function Card({ children, style, animate = true }: { children: React.ReactNode; style?: React.CSSProperties; animate?: boolean }) {
  const motionProps = animate
    ? {
        variants: staggerItem,
        initial: "hidden" as const,
        whileInView: "show" as const,
        viewport: { once: true, margin: "-60px" },
      }
    : {};
  return (
    <motion.div
      {...motionProps}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.6, ease }}
      style={{
        position: "relative", overflow: "hidden",
        borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(14,14,18,0.55)", padding: 28,
        transition: "border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease",
        ...style,
      }}
      onMouseEnter={e => {
        const d = e.currentTarget as HTMLElement;
        d.style.borderColor = "rgba(255,255,255,0.14)";
        d.style.background = "rgba(20,20,26,0.7)";
        d.style.boxShadow = "0 24px 48px rgba(0,0,0,0.45), 0 0 60px rgba(255,255,255,0.04)";
      }}
      onMouseLeave={e => {
        const d = e.currentTarget as HTMLElement;
        d.style.borderColor = "rgba(255,255,255,0.07)";
        d.style.background = "rgba(14,14,18,0.55)";
        d.style.boxShadow = "none";
      }}
    >
      <div style={{ position: "absolute", top: -80, right: -80, width: 220, height: 220, background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 65%)", pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>{children}</div>
    </motion.div>
  );
}

/* ── Code block with copy ─────────────────────────────────────────── */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: "relative", borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.5)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{lang}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", fontSize: 11, padding: "4px 10px", borderRadius: 7, cursor: "pointer", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>
          {copied ? <><Check style={{ width: 11, height: 11 }} /> Copied</> : <><Copy style={{ width: 11, height: 11 }} /> Copy</>}
        </button>
      </div>
      <pre style={{ margin: 0, padding: "16px 18px", fontSize: 12.5, lineHeight: 1.7, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.85)", overflowX: "auto", whiteSpace: "pre" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*                            DOCS PAGE                                */
/* ─────────────────────────────────────────────────────────────────── */
/* ── Docs section sections list (also drives the sticky TOC) ───────── */
const DOC_SECTIONS = [
  { id: "overview",      no: "01", label: "Overview" },
  { id: "model",         no: "02", label: "Mental model" },
  { id: "features",      no: "03", label: "Features" },
  { id: "anatomy",       no: "04", label: "Anatomy of a send" },
  { id: "quickstart",    no: "05", label: "Quick start" },
  { id: "send",          no: "06", label: "Sending" },
  { id: "swap",          no: "07", label: "Swapping" },
  { id: "claim",         no: "08", label: "Claim links" },
  { id: "reclaim",       no: "09", label: "Reclaim" },
  { id: "wallets",       no: "10", label: "Wallets" },
  { id: "coverage",      no: "11", label: "Networks & assets" },
  { id: "fees",          no: "12", label: "Fees & timing" },
  { id: "privacy",       no: "13", label: "Privacy promises" },
  { id: "limits",        no: "14", label: "Limits" },
  { id: "troubleshoot",  no: "15", label: "Troubleshooting" },
  { id: "glossary",      no: "16", label: "Glossary" },
  { id: "faq",           no: "17", label: "FAQ" },
  { id: "support",       no: "18", label: "Support" },
] as const;

export function DocsPage() {
  const [active, setActive] = useState<string>("overview");
  const activeIdx = DOC_SECTIONS.findIndex(s => s.id === active);
  const prev = activeIdx > 0 ? DOC_SECTIONS[activeIdx - 1] : null;
  const next = activeIdx < DOC_SECTIONS.length - 1 ? DOC_SECTIONS[activeIdx + 1] : null;

  const navBtnStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8,
    background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.5)", fontSize: 13, padding: "10px 18px",
    borderRadius: 10, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif",
    letterSpacing: "-0.01em", transition: "all 180ms ease",
  };

  return (
    <Shell active="docs">
      <PageHero
        eyebrow="Documentation · v1.0"
        title={<>The D3FAULT<br /><span style={{ color: "rgba(255,255,255,0.36)" }}>handbook.</span></>}
        sub="One document covering everything: the mental model behind the protocol, how each surface in the app works, supported assets and wallets, our privacy promises, troubleshooting, and a glossary. No separate developer site, no marketing fluff. Read it end-to-end or jump to what you need."
      />

      {/* Whitepaper meta strip */}
      <section style={{ paddingTop: 12, paddingBottom: 32 }}>
        <Wrap>
          <Reveal>
            <div className="d3-meta-strip" style={{
              display: "flex", flexWrap: "wrap", gap: 36, alignItems: "baseline",
              padding: "16px 22px", borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(10,10,14,0.5)",
            }}>
              {[
                { k: "Version", v: "1.0.0" },
                { k: "Last updated", v: "May 2026" },
                { k: "Reading time", v: "~12 min" },
                { k: "Audience", v: "End users" },
                { k: "Network", v: "Solana mainnet" },
              ].map(m => (
                <div key={m.k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{m.k}</span>
                  <span style={{ fontSize: 13.5, color: "white", fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "-0.01em" }}>{m.v}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </Wrap>
      </section>

      {/* Two-column layout: sticky TOC + content */}
      <section style={{ paddingTop: 20, paddingBottom: 80 }}>
        <Wrap>
          <div className="d3-docs-grid" style={{ display: "grid", gridTemplateColumns: "minmax(0, 220px) minmax(0, 1fr)", gap: 64, alignItems: "start" }}>
            <DocsSidebar active={active} onSelect={setActive} />
            <div style={{ minWidth: 0 }}>
              <AnimatePresence mode="wait">
                <motion.div key={active} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25, ease }}>
              {/* 01 Overview */}
              {active === "overview" && (<DocSection id="overview" no="01" label="Overview" title="What D3FAULT is, in one paragraph.">
                <Prose>
                  <DropCap>D</DropCap>3FAULT is a privacy layer for Solana that lets you swap, send, and receive value without leaving a public link between the wallet that paid and the wallet that received. The user experience is the same as any modern Solana app — connect a wallet, choose an action, sign once. The difference is what shows up on-chain afterwards: the deposit and the settlement are both visible and verifiable, but the edge between them isn't. Funds never sit in a custodial pool, no one at D3FAULT can move your money, and the recipient doesn't need a single lamport in their wallet to receive.
                </Prose>
                <Callout kind="note">
                  The formal protocol specification lives at{" "}
                  <a href="https://whitepaper.d3fault.sh" target="_blank" rel="noreferrer" style={{ color: "white", textDecoration: "underline" }}>whitepaper.d3fault.sh</a>.{" "}
                  This handbook covers the product — how every feature works, what we store, and how the on-chain program behaves.
                </Callout>
              </DocSection>)}

              {/* 02 Mental model */}
              {active === "model" && (<DocSection id="model" no="02" label="Mental model" title="Three ideas that explain everything else.">
                <Prose>
                  Three concepts run through every action in the app. Hold these three in your head and the rest of the document will read like a checklist rather than an explanation.
                </Prose>
                <NumberList items={[
                  { h: "Commit, then settle.", b: "Every private action is two on-chain transactions instead of one. The first commits a sealed deposit; the second releases it into a fresh wallet. Both transactions are public; the link between them is not." },
                  { h: "The recipient is always a new wallet.", b: "Funds never land in the same wallet that paid. The receiving address is either a brand-new keypair generated for this transfer or one supplied by the recipient. Either way, it has no on-chain history with the sender." },
                  { h: "The relayer pays the gas.", b: "Settlement is sponsored. A relayer wallet — funded by the protocol fee — pays compute and rent on the recipient's behalf so they can receive funds without holding any SOL." },
                ]} />
              </DocSection>)}

              {/* 03 Features */}
              {active === "features" && (<DocSection id="features" no="03" label="Features" title="Six surfaces, one privacy guarantee.">
                <FeatureRows items={[
                  { Icon: Send,        h: "Private send",   b: "Move SOL or any supported SPL token to a fresh wallet. The on-chain trail starts and ends with you — no edge connects you to the recipient." },
                  { Icon: Repeat,      h: "Private swap",   b: "Trade one asset for another and let the output land in a wallet that has no history with the input. Ordinary DEX UX, no leakage at the edges." },
                  { Icon: Link2,       h: "Claim links",    b: "Send funds to anyone who hasn't connected a wallet yet. They open a link, get a fresh wallet, gas is sponsored — done." },
                  { Icon: RotateCcw,   h: "Reclaim",        b: "If a claim is never completed inside its window, you take the funds back from the same wallet that funded the deposit. Nothing ever stays trapped in the program." },
                  { Icon: Zap,         h: "Sponsored gas",  b: "Recipients don't need a single lamport. The relayer fronts compute and rent for the settlement transaction, repaid from the protocol fee." },
                  { Icon: ShieldCheck, h: "Self-custody",   b: "Keys live in your wallet — extension, mobile, or our built-in browser wallet. The program holds funds for the duration of a single send and never touches them again." },
                ]} />
              </DocSection>)}

              {/* 04 Anatomy of a send */}
              {active === "anatomy" && (<DocSection id="anatomy" no="04" label="Anatomy of a send" title="What actually happens between sign and settle.">
                <Prose>
                  Every private transfer is the same five-step pipeline. Open the app, hit Send, and this is what runs in the background. The sender's wallet signs once at the start; everything else is automatic.
                </Prose>
                <Timeline steps={[
                  { t: "T+0ms",   h: "Generate",  b: "Your browser generates a one-time secret. It never touches our servers, never appears in any URL beyond a fragment, and is discarded the moment the claim settles." },
                  { t: "T+200ms", h: "Commit",    b: "A SHA-256 hash of that secret is written to the on-chain program in the same instruction that locks your deposit. Atomic — either both succeed or both revert." },
                  { t: "T+400ms", h: "Sign",      b: "Your wallet signs the deposit + commitment. The protocol fee (0.25%) is taken inside this same instruction. You only sign once." },
                  { t: "T+1.0s",  h: "Relay",     b: "The recipient (or you, on their behalf) submits the secret. The relayer wraps it into a withdrawal transaction, pays compute, and broadcasts." },
                  { t: "T+2.0s",  h: "Settle",    b: "The program verifies the secret matches the commitment, releases the funds to the recipient's address, and burns the commitment so it can't be replayed." },
                ]} />
              </DocSection>)}

              {/* 05 Quick start */}
              {active === "quickstart" && (<DocSection id="quickstart" no="05" label="Quick start" title="Four steps to your first private send.">
                <Prose>
                  No setup, no waitlist, no API keys. If you can use Phantom you can use D3FAULT.
                </Prose>
                <NumberList items={[
                  { h: "Connect", b: "Open the app and connect a Solana wallet — Phantom, Backpack, Jupiter, or Solflare. Or create or import one inside our built-in browser wallet." },
                  { h: "Choose",  b: "Pick Send, Swap, or Claim from the sidebar. Enter the asset, the amount, and where it should land." },
                  { h: "Confirm", b: "Review the flat 0.25% protocol fee and the destination. Sign once in your wallet." },
                  { h: "Verify",  b: "Every action produces a Solscan link for both legs. The settlement is on-chain. The link between them is not." },
                ]} />
              </DocSection>)}

              {/* 06 Sending */}
              {active === "send" && (<DocSection id="send" no="06" label="Sending" title="Send SOL or any SPL token, privately.">
                <Prose>
                  The Send tab moves a fixed amount of one asset to a single recipient address. The output wallet has no on-chain link to the wallet that funded the deposit.
                </Prose>
                <SubSection h="Inputs">
                  <Bullets items={[
                    "Asset — SOL or any token from the Networks & assets list.",
                    "Amount — denominated in the asset, not in USD. The app shows a USD reference next to it.",
                    "Recipient address — a Solana base58 public key the funds should land at.",
                    "Optional memo — never written on-chain; only used in your local activity log.",
                  ]} />
                </SubSection>
                <SubSection h="What you sign">
                  <Prose tight>
                    A single Solana transaction containing three instructions: token transfer (or system transfer for SOL), protocol fee transfer, and commitment write. The deposit and the fee are atomic — there is no path where the fee is taken without the deposit succeeding.
                  </Prose>
                </SubSection>
                <SubSection h="What the recipient sees">
                  <Prose tight>
                    A normal credit to their wallet, sponsored by the relayer. The transaction signer in their explorer view is the relayer address, not yours.
                  </Prose>
                </SubSection>
              </DocSection>)}

              {/* 07 Swap */}
              {active === "swap" && (<DocSection id="swap" no="07" label="Swapping" title="Trade with the output landing in a fresh wallet.">
                <Prose>
                  The Swap tab routes through Solana's deepest aggregators (Jupiter routing tables) and writes the output into a fresh wallet rather than the wallet that paid. From a public-explorer perspective, the address that received the swap output has no prior history with the address that funded it.
                </Prose>
                <Callout kind="note">
                  Slippage, route, and price impact behave exactly like any Solana DEX UI. The privacy layer sits in front of the aggregator, not inside it.
                </Callout>
                <SubSection h="When to use Swap vs Send">
                  <Bullets items={[
                    "Use Send when the asset you have and the asset you want are the same.",
                    "Use Swap when you want a different output asset (e.g. pay in SOL, receive USDC into a fresh wallet).",
                    "Use Claim links when you don't yet know the recipient's wallet address.",
                  ]} />
                </SubSection>
              </DocSection>)}

              {/* 08 Claim links */}
              {active === "claim" && (<DocSection id="claim" no="08" label="Claim links" title="Send funds to someone who has no wallet yet.">
                <Prose>
                  A claim link is a single URL that contains a sealed secret in its fragment (after the <Mono>#</Mono>). When the recipient opens it, the app reads the secret locally, generates a fresh wallet for them if needed, and submits the withdrawal to the relayer. They never had to install anything to receive.
                </Prose>
                <SubSection h="Anatomy of a claim URL">
                  <CodeRow code="https://d3fault.sh/claim#<base64-secret>" lang="URL" />
                  <Prose tight>
                    Everything before the <Mono>#</Mono> is sent to our servers. Everything after the <Mono>#</Mono> stays in the browser by HTTP-spec design — we never see the secret.
                  </Prose>
                </SubSection>
                <SubSection h="Lifecycle">
                  <Bullets items={[
                    "You generate the link in the Send tab and share it through any channel — DM, email, QR.",
                    "Recipient opens the link. The app decrypts the secret, finds the matching commitment on-chain, and offers them a one-click claim.",
                    "Relayer broadcasts the withdrawal. Funds land in the recipient's address (existing or freshly generated).",
                    "If the link is never opened, see Reclaim.",
                  ]} />
                </SubSection>
                <Callout kind="warn">
                  Treat the link like cash. Anyone who has the URL can claim it. If you suspect a link leaked, reclaim immediately and re-issue.
                </Callout>
              </DocSection>)}

              {/* 09 Reclaim */}
              {active === "reclaim" && (<DocSection id="reclaim" no="09" label="Reclaim" title="Take a deposit back if it's never claimed.">
                <Prose>
                  Every claim has a window — by default, fourteen days from creation. If the link has not been spent inside that window, the original sender can reclaim the deposit from the same wallet that funded it. The protocol fee is non-refundable; everything else returns intact.
                </Prose>
                <SubSection h="How to reclaim">
                  <NumberList compact items={[
                    { h: "Open Reclaim",        b: "From the app sidebar. The list shows every still-claimable commitment your connected wallet ever funded." },
                    { h: "Pick the commitment", b: "Each row shows the amount, the asset, the time created, and the time remaining in the window." },
                    { h: "Sign the reclaim",    b: "One signature from the original sender wallet. The program verifies you are the depositor and releases the funds." },
                  ]} />
                </SubSection>
                <Callout kind="note">
                  Reclaim is also how you wind down a misdirected link. If you generated a claim and shared it with the wrong person, reclaim it before they open it.
                </Callout>
              </DocSection>)}

              {/* 10 Wallets */}
              {active === "wallets" && (<DocSection id="wallets" no="10" label="Wallets" title="Bring your wallet — or use ours.">
                <Prose>
                  D3FAULT supports the four major Solana wallets and ships its own browser-side wallet for users who don't want to install an extension. Either path is fully self-custodial; no D3FAULT server ever sees a private key.
                </Prose>
                <StaggerGrid columns="repeat(4, minmax(0, 1fr))" gap={12} className="d3-wallets-grid">
                  {[
                    { name: "Phantom",  note: "Browser & mobile" },
                    { name: "Backpack", note: "Browser & mobile" },
                    { name: "Jupiter",  note: "Browser & mobile" },
                    { name: "Solflare", note: "Browser & mobile" },
                  ].map(w => (
                    <Card key={w.name} style={{ padding: 22 }}>
                      <h4 style={{ fontSize: 14.5, fontWeight: 600, color: "white", margin: "0 0 6px 0", letterSpacing: "-0.015em" }}>{w.name}</h4>
                      <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "0.04em" }}>{w.note}</span>
                    </Card>
                  ))}
                </StaggerGrid>
                <div style={{ marginTop: 12 }}>
                  <Card>
                    <div className="d3-wallet-row" style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", alignItems: "center", gap: 22 }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 14,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "linear-gradient(165deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
                      }}>
                        <KeyRound style={{ width: 22, height: 22, color: "white" }} />
                      </div>
                      <div>
                        <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 8 }}>Built-in browser wallet</span>
                        <h4 style={{ fontSize: 17, fontWeight: 600, color: "white", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>Create or import a wallet, right inside the app.</h4>
                        <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: 0, maxWidth: 640 }}>
                          Generate a fresh keypair in seconds, or import an existing one with your seed phrase. Keys are AES-encrypted with a passphrase you choose and stored only in your browser's local storage — they never reach our servers.
                        </p>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {["Create new", "Import seed"].map(t => (
                          <span key={t} style={{
                            fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.85)",
                            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                            letterSpacing: "0.04em",
                            padding: "7px 12px", borderRadius: 8,
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            whiteSpace: "nowrap",
                          }}>{t}</span>
                        ))}
                      </div>
                    </div>
                  </Card>
                </div>
              </DocSection>)}

              {/* 11 Networks & assets */}
              {active === "coverage" && (<DocSection id="coverage" no="11" label="Networks & assets" title="Where it works and what you can move.">
                <div className="d3-networks-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Card>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 16 }}>Networks</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {[
                        { net: "Solana mainnet-beta", status: "Live" },
                        { net: "Solana devnet",       status: "Test only" },
                        { net: "Other chains",        status: "Not planned" },
                      ].map(n => (
                        <div key={n.net} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                          <span style={{ fontSize: 14, color: "white", fontWeight: 500 }}>{n.net}</span>
                          <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.45)", fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "0.06em", textTransform: "uppercase" }}>{n.status}</span>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.6, margin: "16px 0 0 0" }}>
                      D3FAULT is Solana-native. We don't bridge or wrap; everything stays on one chain to keep the privacy guarantee tight.
                    </p>
                  </Card>
                  <Card>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 16 }}>Assets</span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {["SOL", "USDC", "USDT", "JitoSOL", "mSOL", "bSOL", "JUP", "JTO", "BONK", "WIF", "PYTH", "RAY", "ORCA", "WEN"].map(t => (
                        <span key={t} style={{
                          fontSize: 11.5, fontWeight: 600, color: "rgba(255,255,255,0.85)",
                          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                          letterSpacing: "0.04em",
                          padding: "6px 10px", borderRadius: 7,
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}>{t}</span>
                      ))}
                    </div>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", lineHeight: 1.6, margin: "18px 0 0 0" }}>
                      Live coverage updates inside the app. New SPL tokens are added as routing depth supports them — request anything missing through the X account.
                    </p>
                  </Card>
                </div>
              </DocSection>)}

              {/* 12 Fees & timing */}
              {active === "fees" && (<DocSection id="fees" no="12" label="Fees & timing" title="One number for cost. One number for speed.">
                <Prose>
                  D3FAULT charges a flat 0.25% protocol fee on the amount sent, taken atomically from the deposit instruction. Recipients pay nothing — gas and rent for the settlement are absorbed by the relayer and reimbursed from this fee. There are no priority surcharges, no tier upsells, and no hidden spreads on swaps beyond the aggregator's published price impact.
                </Prose>
                <KvTable rows={[
                  { k: "Protocol fee",         v: "0.25% of deposit amount" },
                  { k: "Recipient gas",        v: "0 SOL — fronted by relayer" },
                  { k: "Net to recipient",     v: "99.75% of deposit, exact" },
                  { k: "Settlement finality",  v: "≈ 400ms (one Solana slot)" },
                  { k: "End-to-end latency",   v: "Typically < 5 seconds" },
                  { k: "Claim window default", v: "14 days, configurable per send" },
                ]} />
              </DocSection>)}

              {/* 13 Privacy promises */}
              {active === "privacy" && (<DocSection id="privacy" no="13" label="Privacy promises" title="What we never store.">
                <Prose>
                  This list is not aspirational. Every category below is enforced at the architecture level: the data simply isn't collected anywhere it could be retrieved from later, even with a subpoena.
                </Prose>
                <Bullets items={[
                  "Sender ↔ recipient mappings",
                  "Wallet IP addresses or device fingerprints",
                  "Plaintext secrets, claim codes, or seed phrases",
                  "Transaction history beyond what the chain shows publicly",
                  "Custodial balances of any kind",
                  "Email, KYC data, or any identity material for end users",
                ]} />
                <Callout kind="note">
                  Operational metrics like aggregate transaction counts and fee revenue are tracked and published openly. Nothing tied to an individual wallet ever is.
                </Callout>
              </DocSection>)}

              {/* 14 Limits */}
              {active === "limits" && (<DocSection id="limits" no="14" label="Limits" title="What the program enforces.">
                <KvTable rows={[
                  { k: "Min send (SOL)",         v: "0.01 SOL" },
                  { k: "Min send (SPL)",         v: "Asset's minimum unit + dust threshold" },
                  { k: "Max single send",        v: "No hard cap; relayer reserves a per-block headroom" },
                  { k: "Max active claim links", v: "Unlimited per wallet" },
                  { k: "Reclaim window",         v: "Same as claim window — funds available the moment it expires" },
                  { k: "Replay protection",      v: "Commitment is burned at settle; cannot be reused" },
                ]} />
              </DocSection>)}

              {/* 15 Troubleshooting */}
              {active === "troubleshoot" && (<DocSection id="troubleshoot" no="15" label="Troubleshooting" title="When something looks wrong.">
                <TroubleList items={[
                  { h: "\"Invalid Link\" on the claim page",       b: "The URL is missing the secret in its fragment. Make sure you opened the full link — the part after the # is required and must not be stripped by the messenger app you used. Ask the sender to re-share, copying the entire URL." },
                  { h: "Wallet popup never appears",                b: "Your wallet extension may have lost focus. Click the extension icon manually, or refresh the page and re-trigger. If using mobile, switch to the wallet's in-app browser." },
                  { h: "Transaction failed: blockhash expired",     b: "Solana network was congested when your wallet signed. Just retry — the app rebuilds the transaction with a fresh blockhash." },
                  { h: "Recipient's wallet shows no balance",       b: "Confirm the settlement transaction succeeded by clicking the Solscan link in your activity. If it confirmed, the funds are at the recipient's address — they may need to refresh their wallet." },
                  { h: "Reclaim button greyed out",                 b: "The connected wallet is not the one that funded the original deposit, or the claim has already been settled. Switch wallets or check the Activity tab for the final state." },
                ]} />
              </DocSection>)}

              {/* 16 Glossary */}
              {active === "glossary" && (<DocSection id="glossary" no="16" label="Glossary" title="Words you'll see in the app.">
                <DefList items={[
                  { term: "Commitment",       def: "A SHA-256 hash of a one-time secret, written on-chain alongside the deposit. The program will only release funds for a withdrawal that proves knowledge of the matching secret." },
                  { term: "Relayer",          def: "A non-custodial wallet operated by the protocol that pays gas for settlement transactions and is reimbursed from the protocol fee." },
                  { term: "Claim link",       def: "A URL containing the secret in its fragment. Anyone holding the link can claim the deposit. Treat it like cash." },
                  { term: "Reclaim",          def: "The path by which the original sender can recover an unclaimed deposit after the claim window expires." },
                  { term: "Settle",           def: "The on-chain step that releases funds from the program to the recipient and burns the commitment." },
                  { term: "Sealed edge",      def: "The cryptographic guarantee that the deposit transaction and the settlement transaction cannot be linked by an outside observer." },
                  { term: "Sponsored gas",    def: "Compute and rent for the settlement, paid by the relayer instead of the recipient." },
                  { term: "Browser wallet",   def: "D3FAULT's built-in self-custody wallet that stores AES-encrypted keys in your browser's local storage." },
                ]} />
              </DocSection>)}

              {/* 17 FAQ */}
              {active === "faq" && (<DocSection id="faq" no="17" label="FAQ" title="Questions, answered straight.">
                <FaqList items={[
                  { q: "Is D3FAULT custodial?", a: "No. The program holds the deposit only between commit and settle — usually a few seconds, at most a few minutes. Your wallet signs the deposit, and the recipient's wallet is the only one that can ever pull the funds out. We never have a key that can move your money." },
                  { q: "How is this different from a regular DEX?", a: "On a regular DEX, the address you send from and the address that receives the output are publicly linked forever. D3FAULT routes the output through a private settlement layer so the receiving wallet has no on-chain edge back to your trading wallet." },
                  { q: "Do I need SOL in the receiving wallet?", a: "No. The relayer pays gas for the withdrawal and rent for any new accounts. The recipient can be a brand-new wallet with zero balance — they'll have a usable balance the moment the claim settles." },
                  { q: "Which assets are supported?", a: "Native SOL plus the major SPL tokens on Solana — USDC, USDT, JitoSOL, mSOL, JUP, BONK, WIF, JTO and others. The supported list is published live in the app and grows as routing depth allows." },
                  { q: "What does it cost to use?", a: "A flat 0.25% protocol fee on the amount sent. Recipients pay nothing — gas is absorbed by the relayer and reimbursed from that fee. There are no priority surcharges, no hidden spreads, no tier upsells." },
                  { q: "How long does a send take?", a: "Typically under five seconds end-to-end on a healthy Solana epoch. The deposit and the settlement are each one Solana slot (~400ms); the rest is wallet signing and relayer broadcast." },
                  { q: "What happens if the recipient never claims?", a: "Every claim has a window. If it expires unspent, the original sender can reclaim the deposit from the same wallet that funded it. Nothing ever stays trapped in the program." },
                  { q: "Do you log my IP, device, or wallet activity?", a: "No. We don't store sender↔recipient mappings, IP addresses, device fingerprints, plaintext secrets, or any history beyond what already lives on-chain. The Privacy promises section above lists every category we explicitly do not retain." },
                  { q: "Is the program audited?", a: "The Anchor program is upgrade-renounced and undergoing review with two independent firms. Reports will be published on the Security page when complete. Until then, the source is open and the program ID on Solana mainnet is verifiable." },
                  { q: "Can I use the built-in wallet on multiple devices?", a: "Yes — by importing the same seed phrase on each. The browser wallet stores keys locally per-device, so initial setup must happen on each browser you want to use." },
                  { q: "What happens if I lose my browser wallet's passphrase?", a: "We can't recover it — that's the trade-off of true self-custody. The seed phrase you wrote down at creation is your only recovery path. Store it somewhere offline." },
                ]} />
              </DocSection>)}

              {/* 18 Support */}
              {active === "support" && (<DocSection id="support" no="18" label="Support" title="Get a human, fast.">
                <div className="d3-networks-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <Card>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 12 }}>Public</span>
                    <h4 style={{ fontSize: 18, fontWeight: 600, color: "white", margin: "0 0 8px 0", letterSpacing: "-0.02em" }}>X — @d3fault_sh</h4>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: "0 0 14px 0" }}>
                      Questions, missing-asset requests, and product feedback. We answer in public.
                    </p>
                    <a href="https://x.com/d3fault_sh" target="_blank" rel="noreferrer" style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      fontSize: 13, color: "white", textDecoration: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 2,
                    }}>x.com/d3fault_sh <ArrowUpRight style={{ width: 12, height: 12 }} /></a>
                  </Card>
                  <Card>
                    <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 12 }}>Verifiable</span>
                    <h4 style={{ fontSize: 18, fontWeight: 600, color: "white", margin: "0 0 8px 0", letterSpacing: "-0.02em" }}>On-chain program</h4>
                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: "0 0 14px 0" }}>
                      Inspect the live, immutable Anchor program on Solscan. Verify the relayer wallet too, while you're there.
                    </p>
                    <a href="https://solscan.io/account/2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG" target="_blank" rel="noreferrer" style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      fontSize: 13, color: "white", textDecoration: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: 2,
                    }}>Open on Solscan <ArrowUpRight style={{ width: 12, height: 12 }} /></a>
                  </Card>
                </div>
              </DocSection>)}
                </motion.div>
              </AnimatePresence>

              {/* Prev / Next navigation */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 48, paddingTop: 32, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {prev ? (
                  <button
                    onClick={() => setActive(prev.id)}
                    style={navBtnStyle}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "white"; el.style.borderColor = "rgba(255,255,255,0.2)"; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(255,255,255,0.5)"; el.style.borderColor = "rgba(255,255,255,0.08)"; }}
                  >
                    ← {prev.label}
                  </button>
                ) : <span />}
                {next ? (
                  <button
                    onClick={() => setActive(next.id)}
                    style={navBtnStyle}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "white"; el.style.borderColor = "rgba(255,255,255,0.2)"; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = "rgba(255,255,255,0.5)"; el.style.borderColor = "rgba(255,255,255,0.08)"; }}
                  >
                    {next.label} →
                  </button>
                ) : <span />}
              </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </Wrap>
      </section>
    </Shell>
  );
}

/* ── Sticky table of contents (controlled) ───────────────────────── */
function DocsSidebar({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <aside className="d3-docs-sidebar" style={{ position: "sticky", top: 110, alignSelf: "start", maxHeight: "calc(100vh - 130px)", overflowY: "auto" }}>
      <div style={{ padding: "18px 0", borderLeft: "1px solid rgba(255,255,255,0.06)" }}>
        <span style={{ display: "block", fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 16, paddingLeft: 18 }}>Contents</span>
        <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {DOC_SECTIONS.map(s => {
            const isActive = active === s.id;
            return (
              <button key={s.id} onClick={() => onSelect(s.id)}
                style={{
                  position: "relative", display: "flex", alignItems: "baseline", gap: 10,
                  padding: "7px 18px", background: "transparent", border: "none", cursor: "pointer",
                  textAlign: "left", width: "100%",
                  fontSize: 12.5, color: isActive ? "white" : "rgba(255,255,255,0.45)",
                  letterSpacing: "-0.005em", lineHeight: 1.4,
                  transition: "color 0.2s ease",
                  borderLeft: isActive ? "1px solid white" : "1px solid transparent",
                  marginLeft: -1,
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.8)"; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.45)"; }}
              >
                <span style={{ fontSize: 9.5, fontFamily: "'JetBrains Mono', ui-monospace, monospace", color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em", flexShrink: 0 }}>{s.no}</span>
                <span>{s.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

/* ── Section wrapper with anchor and consistent header ────────────── */
function DocSection({ id, no, label, title, children }: { id: string; no: string; label: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="d3-doc-sec" style={{ paddingTop: 8, paddingBottom: 56, scrollMarginTop: 100 }}>
      <Reveal>
        <div className="d3-doc-sec-header" style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 18 }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{no} · {label}</span>
        </div>
        <h2 style={{ fontSize: "clamp(24px, 2.6vw, 32px)", fontWeight: 700, color: "white", letterSpacing: "-0.025em", lineHeight: 1.15, margin: "0 0 26px 0" }}>{title}</h2>
      </Reveal>
      <div>{children}</div>
    </section>
  );
}

/* ── Prose paragraph (whitepaper body text) ───────────────────────── */
function Prose({ children, tight = false }: { children: React.ReactNode; tight?: boolean }) {
  return (
    <Reveal>
      <p style={{
        fontSize: tight ? 14 : 15.5, color: "rgba(255,255,255,0.7)",
        lineHeight: tight ? 1.7 : 1.75, fontWeight: 400,
        margin: tight ? "0 0 14px 0" : "0 0 20px 0",
        maxWidth: 720, letterSpacing: "-0.005em",
      }}>
        {children}
      </p>
    </Reveal>
  );
}

function DropCap({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      float: "left",
      fontSize: 56, lineHeight: 0.85, fontWeight: 700, color: "white",
      paddingRight: 12, paddingTop: 4, paddingBottom: 0,
      fontFamily: "'Space Grotesk', system-ui, sans-serif",
      letterSpacing: "-0.04em",
    }}>{children}</span>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: "0.9em", padding: "1px 6px", borderRadius: 5,
      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
      color: "white", letterSpacing: "-0.005em",
    }}>{children}</span>
  );
}

/* ── Sub-section heading inside a DocSection ──────────────────────── */
function SubSection({ h, children }: { h: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <div style={{ marginTop: 14, marginBottom: 22 }}>
        <h3 style={{
          fontSize: 13, fontWeight: 600, color: "white",
          margin: "0 0 12px 0", letterSpacing: "0.04em", textTransform: "uppercase",
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>{h}</h3>
        {children}
      </div>
    </Reveal>
  );
}

/* ── Numbered list (premium step layout) ──────────────────────────── */
function NumberList({ items, compact = false }: { items: { h: string; b: string }[]; compact?: boolean }) {
  return (
    <motion.ol
      initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      style={{ listStyle: "none", padding: 0, margin: "10px 0 18px 0", display: "flex", flexDirection: "column", gap: compact ? 12 : 18 }}>
      {items.map((it, i) => (
        <motion.li key={i} variants={staggerItem}
          style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 18, alignItems: "baseline" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 28, height: 28, borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)",
            fontSize: 11, fontWeight: 600, color: "white", letterSpacing: "0.04em",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          }}>{String(i + 1).padStart(2, "0")}</span>
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: "white", margin: "0 0 4px 0", letterSpacing: "-0.015em" }}>{it.h}</h4>
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: 0, maxWidth: 680 }}>{it.b}</p>
          </div>
        </motion.li>
      ))}
    </motion.ol>
  );
}

/* ── Feature rows with icon ───────────────────────────────────────── */
function FeatureRows({ items }: { items: { Icon: React.ComponentType<{ style?: React.CSSProperties }>; h: string; b: string }[] }) {
  return (
    <motion.div
      initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
      style={{ display: "flex", flexDirection: "column", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {items.map((it, i) => (
        <motion.div key={i} variants={staggerItem}
          style={{ display: "grid", gridTemplateColumns: "44px 1fr", gap: 20, padding: "20px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, marginTop: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.1)",
            background: "linear-gradient(165deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))",
          }}>
            <it.Icon style={{ width: 16, height: 16, color: "white" }} />
          </div>
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 600, color: "white", margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>{it.h}</h4>
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: 0, maxWidth: 720 }}>{it.b}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ── Vertical timeline (anatomy of a send) ────────────────────────── */
function Timeline({ steps }: { steps: { t: string; h: string; b: string }[] }) {
  return (
    <motion.div
      initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}
      style={{ position: "relative", paddingLeft: 28, marginTop: 12 }}>
      {/* Vertical line */}
      <div style={{ position: "absolute", left: 9, top: 6, bottom: 6, width: 1, background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.18), transparent)" }} />
      {steps.map((s, i) => (
        <motion.div key={i} variants={staggerItem}
          style={{ position: "relative", marginBottom: i < steps.length - 1 ? 26 : 0 }}>
          {/* Dot */}
          <div style={{
            position: "absolute", left: -28, top: 6, width: 18, height: 18,
            borderRadius: "50%", border: "1px solid rgba(255,255,255,0.2)",
            background: "rgba(8,8,12,1)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: "white", boxShadow: "0 0 8px rgba(255,255,255,0.6)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)",
              letterSpacing: "0.16em", textTransform: "uppercase",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              padding: "3px 8px", borderRadius: 5,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
            }}>{s.t}</span>
            <h4 style={{ fontSize: 15, fontWeight: 600, color: "white", margin: 0, letterSpacing: "-0.015em" }}>{s.h}</h4>
          </div>
          <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: 0, maxWidth: 680 }}>{s.b}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ── Bullet list ──────────────────────────────────────────────────── */
function Bullets({ items }: { items: string[] }) {
  return (
    <motion.ul
      initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
      style={{ listStyle: "none", padding: 0, margin: "8px 0 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((s, i) => (
        <motion.li key={i} variants={staggerItem}
          style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "baseline" }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%", background: "white",
            marginTop: 9, boxShadow: "0 0 6px rgba(255,255,255,0.45)", flexShrink: 0,
          }} />
          <span style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", lineHeight: 1.7, letterSpacing: "-0.005em" }}>{s}</span>
        </motion.li>
      ))}
    </motion.ul>
  );
}

/* ── Inline single-line code row ──────────────────────────────────── */
function CodeRow({ code, lang }: { code: string; lang: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)",
      background: "rgba(0,0,0,0.45)", padding: "12px 16px", marginBottom: 12,
    }}>
      <code style={{
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: 12.5, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.005em",
        overflowX: "auto", whiteSpace: "nowrap",
      }}>{code}</code>
      <span style={{
        fontSize: 9.5, fontWeight: 600, color: "rgba(255,255,255,0.4)",
        letterSpacing: "0.16em", textTransform: "uppercase", marginLeft: 16,
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      }}>{lang}</span>
    </div>
  );
}

/* ── Callout (premium info / warning) ─────────────────────────────── */
function Callout({ kind, children }: { kind: "note" | "warn"; children: React.ReactNode }) {
  const Icon = kind === "warn" ? AlertCircle : BookOpen;
  return (
    <Reveal>
      <div style={{
        display: "grid", gridTemplateColumns: "auto 1fr", gap: 14,
        padding: "16px 18px", marginBottom: 22,
        borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(20,20,26,0.4)",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 2, background: "linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(255,255,255,0.1))" }} />
        <Icon style={{ width: 16, height: 16, color: "rgba(255,255,255,0.7)", marginTop: 2 }} />
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.65, margin: 0, maxWidth: 700, letterSpacing: "-0.005em" }}>{children}</p>
      </div>
    </Reveal>
  );
}

/* ── Key/value table ──────────────────────────────────────────────── */
function KvTable({ rows }: { rows: { k: string; v: string }[] }) {
  return (
    <Reveal>
      <div style={{
        borderRadius: 12, border: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(14,14,18,0.45)", overflow: "hidden", marginBottom: 22,
      }}>
        {rows.map((r, i) => (
          <div key={r.k} className="d3-kv-row" style={{
            display: "grid", gridTemplateColumns: "minmax(160px, 220px) 1fr",
            gap: 24, padding: "13px 20px",
            borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            alignItems: "baseline",
          }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.14em", textTransform: "uppercase",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            }}>{r.k}</span>
            <span style={{ fontSize: 14, color: "white", lineHeight: 1.55, letterSpacing: "-0.005em" }}>{r.v}</span>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

/* ── Definition list (glossary) ───────────────────────────────────── */
function DefList({ items }: { items: { term: string; def: string }[] }) {
  return (
    <motion.dl
      initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
      style={{ margin: 0, padding: 0, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
      {items.map(it => (
        <motion.div key={it.term} variants={staggerItem}
          className="d3-def-row"
          style={{ display: "grid", gridTemplateColumns: "minmax(140px, 200px) 1fr", gap: 24, padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", alignItems: "baseline" }}>
          <dt style={{
            fontSize: 13.5, fontWeight: 600, color: "white",
            letterSpacing: "-0.005em",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <Hash style={{ width: 11, height: 11, color: "rgba(255,255,255,0.35)" }} />
            {it.term}
          </dt>
          <dd style={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.65, margin: 0, letterSpacing: "-0.005em" }}>{it.def}</dd>
        </motion.div>
      ))}
    </motion.dl>
  );
}

/* ── Troubleshooting list ─────────────────────────────────────────── */
function TroubleList({ items }: { items: { h: string; b: string }[] }) {
  return (
    <motion.div
      initial="hidden" whileInView="show" viewport={{ once: true, margin: "-60px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
      style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
      {items.map((it, i) => (
        <motion.div key={i} variants={staggerItem}
          style={{
            display: "grid", gridTemplateColumns: "auto 1fr", gap: 14,
            padding: "16px 18px", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(14,14,18,0.4)",
          }}>
          <HelpCircle style={{ width: 15, height: 15, color: "rgba(255,255,255,0.5)", marginTop: 3 }} />
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: "white", margin: "0 0 6px 0", letterSpacing: "-0.01em" }}>{it.h}</h4>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.65, margin: 0, maxWidth: 720 }}>{it.b}</p>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

/* ── FAQ accordion ────────────────────────────────────────────────── */
function FaqList({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
      style={{
        borderRadius: 16, border: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(14,14,18,0.55)", overflow: "hidden",
      }}>
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <motion.div key={i} variants={staggerItem}
            style={{ borderBottom: i < items.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "22px 26px", background: "transparent", border: "none", cursor: "pointer",
                textAlign: "left", color: "white",
              }}>
              <span style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.35)", letterSpacing: "0.16em", fontFamily: "'JetBrains Mono', ui-monospace, monospace", minWidth: 28 }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 15, fontWeight: 500, color: "white", letterSpacing: "-0.01em" }}>{it.q}</span>
              </span>
              <motion.span animate={{ rotate: isOpen ? 45 : 0 }} transition={{ duration: 0.3, ease }}
                style={{ fontSize: 22, lineHeight: 1, color: "rgba(255,255,255,0.5)", fontWeight: 300, marginLeft: 16 }}>+</motion.span>
            </button>
            <motion.div
              initial={false}
              animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
              transition={{ duration: 0.35, ease }}
              style={{ overflow: "hidden" }}>
              <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, margin: 0, padding: "0 26px 22px 70px", maxWidth: 820 }}>
                {it.a}
              </p>
            </motion.div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*                          PROTOCOL PAGE                              */
/* ─────────────────────────────────────────────────────────────────── */
export function ProtocolPage() {
  return (
    <Shell active="protocol">
      <PageHero
        eyebrow="The Protocol"
        title={<>How D3FAULT<br /><span style={{ color: "rgba(255,255,255,0.36)" }}>actually works.</span></>}
        sub="A non-custodial relay layer that lets anyone send and receive value on Solana without leaking the link between sender and recipient. Open program, deterministic settlement, audit-ready."
      />

      {/* Architecture diagram */}
      <section style={{ paddingTop: 40, paddingBottom: 80 }}>
        <Wrap>
          <SectionTitle eyebrow="01 / Architecture" title="Four moving parts. One immutable program." sub="Wallet, commitment vault, relayer, and recipient. Each step is publicly verifiable on-chain — only the link between deposit and withdrawal stays sealed." />
          <div className="d3-diagram-card">
            <Card style={{ padding: 36 }}>
              <ArchitectureDiagram />
            </Card>
          </div>
        </Wrap>
      </section>

      {/* Lifecycle */}
      <section style={{ paddingTop: 0, paddingBottom: 80 }}>
        <Wrap>
          <SectionTitle eyebrow="02 / Lifecycle" title="Five stages from deposit to settlement." />
          <StaggerGrid columns="repeat(5, minmax(0, 1fr))" gap={12} className="d3-lifecycle-grid">
            {[
              { num: "01", label: "Generate", desc: "Sender creates a one-time secret in their browser. Never leaves the device." },
              { num: "02", label: "Commit", desc: "A cryptographic commitment of that secret is written to the on-chain program alongside the deposit." },
              { num: "03", label: "Share", desc: "Sender hands the recipient a sealed claim link. Only ciphertext travels in transit." },
              { num: "04", label: "Relay", desc: "Recipient submits the claim. A relayer covers gas so the wallet needs zero SOL to start." },
              { num: "05", label: "Settle", desc: "Funds land at the recipient's address. No on-chain edge connects it to the sender." },
            ].map(s => (
              <Card key={s.num} style={{ padding: 22 }}>
                <span style={{ display: "block", fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.45)", letterSpacing: "0.16em", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 12 }}>{s.num}</span>
                <h4 style={{ fontSize: 15, fontWeight: 600, color: "white", margin: "0 0 8px 0", letterSpacing: "-0.02em" }}>{s.label}</h4>
                <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.55, margin: 0 }}>{s.desc}</p>
              </Card>
            ))}
          </StaggerGrid>
          <p style={{ marginTop: 20, fontSize: 12.5, color: "rgba(255,255,255,0.35)", lineHeight: 1.65, maxWidth: 720, fontStyle: "italic" }}>
            The cryptographic primitive that binds these steps is intentionally not detailed here. We publish the open-source Anchor program for inspection by integrators and auditors under NDA — the public surface is sufficient to verify behaviour without becoming a recipe.
          </p>
        </Wrap>
      </section>

      {/* On-chain identity */}
      <section style={{ paddingTop: 0, paddingBottom: 80 }}>
        <Wrap>
          <SectionTitle eyebrow="03 / On-chain identity" title="Verify the protocol, not our word." />
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
              {[
                { label: "Network", value: "Solana mainnet-beta" },
                { label: "Program ID", value: "2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG", mono: true, link: "https://solscan.io/account/2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG" },
                { label: "Relayer wallet", value: "EV7T58wSE5rz9a2psrCXaEL5G2X2aUT76Q9hemyWoDTt", mono: true, link: "https://solscan.io/account/EV7T58wSE5rz9a2psrCXaEL5G2X2aUT76Q9hemyWoDTt" },
                { label: "Upgrade authority", value: "Renounced — program is immutable" },
                { label: "Framework", value: "Anchor 0.30 · Rust" },
                { label: "Settlement finality", value: "Solana single-slot · ≈ 400ms" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{r.label}</span>
                  {r.link ? (
                    <a href={r.link} target="_blank" rel="noreferrer" style={{
                      fontSize: r.mono ? 12 : 14, color: "white",
                      fontFamily: r.mono ? "'JetBrains Mono', ui-monospace, monospace" : "inherit",
                      letterSpacing: r.mono ? "-0.01em" : "-0.015em",
                      wordBreak: "break-all", textDecoration: "none",
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>{r.value} <ExternalLink style={{ width: 11, height: 11, opacity: 0.5, flexShrink: 0 }} /></a>
                  ) : (
                    <span style={{
                      fontSize: r.mono ? 12 : 14, color: "white",
                      fontFamily: r.mono ? "'JetBrains Mono', ui-monospace, monospace" : "inherit",
                      letterSpacing: r.mono ? "-0.01em" : "-0.015em",
                      wordBreak: "break-all",
                    }}>{r.value}</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </Wrap>
      </section>

      {/* Fees & revenue */}
      <section style={{ paddingTop: 0, paddingBottom: 80 }}>
        <Wrap>
          <SectionTitle eyebrow="04 / Fees & revenue" title="One number. Posted in the program." sub="A flat 0.25% protocol fee is taken atomically from every private send. Recipients pay nothing — gas is absorbed by the relayer and reimbursed from this fee. No hidden spreads, no priority surcharges, no token tax." />
          <div className="d3-fees-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
            <Card>
              <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 18 }}>Per-transfer breakdown</span>
              <FeeBar />
              <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { label: "Protocol fee", value: "0.25%", note: "Charged on deposit, in the same instruction." },
                  { label: "Recipient gas", value: "0 SOL", note: "Relayer fronts compute & rent." },
                  { label: "Net to recipient", value: "99.75%", note: "Of the original deposit, on the dot." },
                ].map(f => (
                  <div key={f.label} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    <div>
                      <div style={{ fontSize: 13.5, color: "white", fontWeight: 500 }}>{f.label}</div>
                      <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{f.note}</div>
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 600, color: "white", fontFamily: "'JetBrains Mono', ui-monospace, monospace", letterSpacing: "-0.02em" }}>{f.value}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 18 }}>Where the 0.25% goes</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[
                  { pct: 55, label: "Relayer gas reserve", note: "Funds the wallet that pays compute for every withdraw." },
                  { pct: 25, label: "Protocol treasury", note: "Audits, infra, liability buffer." },
                  { pct: 15, label: "Engineering & ops", note: "The team that keeps the program healthy." },
                  { pct: 5,  label: "Public goods", note: "Solana ecosystem grants, open-source contributions." },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontSize: 13.5, color: "white", fontWeight: 500 }}>{s.label}</span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontWeight: 600 }}>{s.pct}%</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.04)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: `${s.pct}%`, height: "100%", background: "linear-gradient(90deg, rgba(255,255,255,0.35), rgba(255,255,255,0.85))", borderRadius: 999 }} />
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.38)", marginTop: 6 }}>{s.note}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Wrap>
      </section>

      {/* Reliability */}
      <section style={{ paddingTop: 0, paddingBottom: 80 }}>
        <Wrap>
          <SectionTitle eyebrow="05 / Reliability" title="Engineered for every edge a real wallet hits." sub="Privacy is meaningless if funds get stuck. The program and relayer are designed against the full failure surface of a real-world Solana app." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            {[
              { title: "Atomic deposits", body: "Deposit, fee transfer, and commitment are one instruction. They succeed or fail together — no partial state." },
              { title: "Idempotent claims", body: "A claim can be retried safely after a network drop. The program rejects double-withdrawals at the on-chain layer." },
              { title: "Reorg-safe relays", body: "The relayer waits for finality before marking a withdrawal complete and reuses inputs deterministically." },
              { title: "RPC failover", body: "Backend rotates across multiple Solana RPC providers and degrades gracefully when any single provider blips." },
              { title: "Retry queue", body: "Transient failures (blockhash expired, compute price spike) are retried with backoff. Permanent failures surface to the user immediately." },
              { title: "Dead-letter handling", body: "If a claim cannot be settled within its window, the original sender can reclaim. Funds are never trapped by the relayer." },
            ].map(item => (
              <Card key={item.title}>
                <h4 style={{ fontSize: 14.5, fontWeight: 600, color: "white", margin: "0 0 8px 0", letterSpacing: "-0.015em" }}>{item.title}</h4>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, margin: 0 }}>{item.body}</p>
              </Card>
            ))}
          </div>
        </Wrap>
      </section>

      {/* What we don't store */}
      <section style={{ paddingTop: 0, paddingBottom: 40 }}>
        <Wrap>
          <Card>
            <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 16 }}>What we never store</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
              {[
                "Sender ↔ recipient mappings",
                "Wallet IP or device fingerprints",
                "Plaintext secrets or claim codes",
                "Transaction history beyond what the chain shows",
                "Custodial balances of any kind",
                "Email or KYC data for end-users",
              ].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "white", marginTop: 7, flexShrink: 0, boxShadow: "0 0 8px rgba(255,255,255,0.5)" }} />
                  <span style={{ fontSize: 13.5, color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>{item}</span>
                </div>
              ))}
            </div>
          </Card>
        </Wrap>
      </section>
    </Shell>
  );
}

/* ── Architecture diagram (premium SVG, B&W) ──────────────────────── */
function ArchitectureDiagram() {
  const NODE_W = 200, NODE_H = 88;
  const nodes = [
    { x: 20,  label: "Sender", sub: "Browser-side wallet" },
    { x: 260, label: "Program", sub: "Commitment vault (PDA)" },
    { x: 500, label: "Relayer", sub: "Gas-sponsored broadcast" },
    { x: 740, label: "Recipient", sub: "Fresh, unfunded wallet" },
  ];
  const W = 960, H = 230;
  const cy = 114;
  const lineX1 = nodes[0].x + NODE_W;          // 220
  const lineX2 = nodes[nodes.length - 1].x;    // 740
  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 760, height: "auto", display: "block" }}>
        <defs>
          <linearGradient id="line-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </linearGradient>
          <radialGradient id="node-grad" cx="0.3" cy="0.3" r="0.8">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </radialGradient>
        </defs>

        {/* Connecting line */}
        <line x1={lineX1} y1={cy} x2={lineX2} y2={cy} stroke="url(#line-grad)" strokeWidth="1.5" />

        {/* Animated dot traveling along the line */}
        <circle r="4" fill="white" style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.8))" }}>
          <animate attributeName="cx" from={lineX1} to={lineX2} dur="3.6s" repeatCount="indefinite" />
          <animate attributeName="cy" from={cy} to={cy} dur="3.6s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.05;0.95;1" dur="3.6s" repeatCount="indefinite" />
        </circle>

        {/* Nodes */}
        {nodes.map((n, i) => (
          <g key={n.label} transform={`translate(${n.x}, 70)`}>
            <rect width={NODE_W} height={NODE_H} rx="14" fill="url(#node-grad)" stroke="rgba(255,255,255,0.16)" strokeWidth="1" />
            <text x={NODE_W / 2} y="38" textAnchor="middle" fill="white" fontSize="14" fontWeight="600" letterSpacing="-0.02em" fontFamily="Inter, system-ui, sans-serif">{n.label}</text>
            <text x={NODE_W / 2} y="60" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10.5" fontFamily="'JetBrains Mono', ui-monospace, monospace" letterSpacing="0.04em">{n.sub}</text>
            <text x={NODE_W / 2} y="-12" textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="'JetBrains Mono', ui-monospace, monospace" letterSpacing="0.16em">0{i + 1}</text>
          </g>
        ))}

        {/* Sealed segment label — centered under the relay span */}
        <g transform={`translate(${(W - 240) / 2}, 188)`}>
          <rect width="240" height="24" rx="12" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
          <text x="120" y="16" textAnchor="middle" fill="rgba(255,255,255,0.55)" fontSize="9.5" fontFamily="'JetBrains Mono', ui-monospace, monospace" letterSpacing="0.18em">SEALED · UNLINKABLE EDGE</text>
        </g>
      </svg>
    </div>
  );
}

/* ── Fee bar (visual stack) ───────────────────────────────────────── */
function FeeBar() {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", height: 56, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ flex: 99.75, background: "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))", display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "white", letterSpacing: "0.06em", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>RECIPIENT 99.75%</span>
        </div>
        <div style={{ flex: 0.25, background: "rgba(255,255,255,0.55)", minWidth: 4 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>0%</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>FEE 0.25% →</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*                          SECURITY PAGE                              */
/* ─────────────────────────────────────────────────────────────────── */
export function SecurityPage() {
  return (
    <Shell active="security">
      <PageHero
        eyebrow="Security Posture"
        title={<>Verifiable.<br /><span style={{ color: "rgba(255,255,255,0.36)" }}>Not promised.</span></>}
        sub="Trust isn't something we ask for. The program is open-source, the upgrade authority is renounced, and every claim about behaviour can be checked against the chain in real time."
      />

      {/* Pillars */}
      <section style={{ paddingTop: 40, paddingBottom: 80 }}>
        <Wrap>
          <SectionTitle eyebrow="01 / Trust pillars" title="Four guarantees built into the design." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {[
              { label: "Open source", value: "MIT", note: "Anchor program and SDK published in full. Anyone can build, audit, or fork." },
              { label: "Immutable program", value: "Renounced", note: "Upgrade authority was destroyed at deploy. The on-chain logic cannot change under your feet." },
              { label: "Non-custodial", value: "0 custody", note: "No D3FAULT key can move user funds. The relayer broadcasts; it cannot redirect." },
              { label: "Sealed commitments", value: "SHA-256", note: "Public chain data reveals participation, never the link between deposit and withdrawal." },
            ].map(p => (
              <Card key={p.label}>
                <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 12 }}>{p.label}</span>
                <div style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.025em", marginBottom: 10, fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>{p.value}</div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: 0 }}>{p.note}</p>
              </Card>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Threat model */}
      <section style={{ paddingTop: 0, paddingBottom: 80 }}>
        <Wrap>
          <SectionTitle eyebrow="02 / Threat model" title="What we defend against." sub="A high-level summary of the adversaries the protocol is designed to resist. Detailed mitigations are kept private to avoid handing attackers a checklist." />
          <Card style={{ padding: 0 }}>
            {[
              { actor: "Chain observer", goal: "Link a sender to a recipient using public on-chain data.", status: "Mitigated by sealed commitments and relayer-broadcast." },
              { actor: "Relayer compromise", goal: "Censor or redirect a withdrawal in flight.", status: "Bounded by the program — relayer can drop, never redirect. Funds stay reclaimable by sender." },
              { actor: "Front-end compromise", goal: "Inject malicious JavaScript into the official UI.", status: "Mitigated by SRI, signed releases, and a dashboard-side verification hash. Self-host is supported." },
              { actor: "Replay attempt", goal: "Re-submit a captured claim to drain the same commitment twice.", status: "Rejected on-chain. Each commitment can be settled exactly once." },
              { actor: "Griefing / spam", goal: "Exhaust the relayer's gas reserve with junk claims.", status: "Per-key rate limits + economic disincentive baked into the fee model." },
            ].map((t, i, arr) => (
              <div key={t.actor} className="d3-threat-row" style={{ padding: "20px 24px", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", display: "grid", gridTemplateColumns: "1fr 1.4fr 1.6fr", gap: 24, alignItems: "start" }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>Actor</span>
                  <div style={{ fontSize: 14, color: "white", fontWeight: 500, marginTop: 6 }}>{t.actor}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>Goal</span>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginTop: 6, lineHeight: 1.55 }}>{t.goal}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}>Status</span>
                  <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 6, lineHeight: 1.55 }}>{t.status}</div>
                </div>
              </div>
            ))}
          </Card>
        </Wrap>
      </section>

      {/* Audit */}
      <section style={{ paddingTop: 0, paddingBottom: 80 }}>
        <Wrap>
          <SectionTitle eyebrow="03 / Audits" title="Where we are. Where we're going." />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {[
              { tag: "Internal review", state: "Complete", note: "Full pass against our internal threat model before mainnet." },
              { tag: "Community review", state: "Ongoing", note: "Public Anchor source, open issues, and an active disclosure inbox." },
              { tag: "Third-party audit", state: "Engaged", note: "Independent audit firm scoped — report will publish here on completion." },
            ].map(a => (
              <Card key={a.tag}>
                <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 12 }}>{a.tag}</span>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "white", boxShadow: "0 0 8px rgba(255,255,255,0.5)" }} />
                  <span style={{ fontSize: 14, color: "white", fontWeight: 600, letterSpacing: "-0.01em" }}>{a.state}</span>
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: 0 }}>{a.note}</p>
              </Card>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Disclosure */}
      <section style={{ paddingTop: 0, paddingBottom: 40 }}>
        <Wrap>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 18 }}>
              <div style={{ maxWidth: 540 }}>
                <span style={{ display: "block", fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", letterSpacing: "0.16em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', ui-monospace, monospace", marginBottom: 12 }}>Coordinated disclosure</span>
                <h3 style={{ fontSize: 20, fontWeight: 600, color: "white", margin: "0 0 8px 0", letterSpacing: "-0.02em" }}>Found something? Tell us privately first.</h3>
                <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, margin: 0 }}>
                  We respond to all reports within 24 hours. Critical findings are eligible for a bounty paid out of the protocol treasury.
                </p>
              </div>
              <a href="https://x.com/d3fault_sh" target="_blank" rel="noreferrer"
                style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "white", color: "black", padding: "12px 20px", fontSize: 14, fontWeight: 600, borderRadius: 12, textDecoration: "none" }}>
                Contact security <ArrowUpRight style={{ width: 14, height: 14 }} />
              </a>
            </div>
          </Card>
        </Wrap>
      </section>
    </Shell>
  );
}

/* ── Shared shell wrapper ─────────────────────────────────────────── */
function Shell({ children, active }: { children: React.ReactNode; active: "docs" | "protocol" | "security" }) {
  return (
    <div style={{ minHeight: "100vh", background: "black", color: "white", overflowX: "hidden" }}>
      <ScrollProgress />
      <GrainOverlay />
      <InfoNav active={active} />
      <main>{children}</main>
      <InfoFooter />
    </div>
  );
}
