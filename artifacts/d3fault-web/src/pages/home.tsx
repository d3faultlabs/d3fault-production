import React, { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, useScroll, useInView, useTransform, useMotionValue, useSpring, animate } from "framer-motion";
import { ArrowRight, Shield, Zap, Lock, Eye, Github, ExternalLink, Wallet, Repeat, Send, RotateCcw, KeyRound, BarChart3, Code2, Sparkles, Inbox } from "lucide-react";
import { GrainOverlay } from "@/components/GrainOverlay";
import { FluidShader } from "@/components/FluidShader";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

/* ─── Reliable container — all spacing via inline styles ─────────── */
function Wrap({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={`d3-wrap${className ? " " + className : ""}`} style={{
      maxWidth: 1400,
      width: "100%",
      marginLeft: "auto",
      marginRight: "auto",
      paddingLeft: "clamp(24px, 5vw, 80px)",
      paddingRight: "clamp(24px, 5vw, 80px)",
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ─── Text scramble hook ──────────────────────────────────────────── */
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&!~<>{}";

function useScramble(text: string, trigger: boolean, speed = 26) {
  const [display, setDisplay] = useState(text);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!trigger) return;
    let i = 0;
    const total = text.length * 10;
    const tick = () => {
      setDisplay(text.split("").map((ch, idx) => {
        if (ch === " ") return " ";
        if (i >= idx * 10 + 10) return ch;
        return CHARS[Math.floor(Math.random() * CHARS.length)];
      }).join(""));
      i++;
      if (i < total) t.current = setTimeout(tick, speed);
      else setDisplay(text);
    };
    t.current = setTimeout(tick, 300);
    return () => { if (t.current) clearTimeout(t.current); };
  }, [trigger, text, speed]);

  return display;
}

/* ─── Cycling scramble (rotates through words with encrypted transition) ── */
function CycleScramble({
  words,
  holdMs = 1000,
  scrambleSpeed = 24,
}: {
  words: string[];
  holdMs?: number;
  scrambleSpeed?: number;
}) {
  const [display, setDisplay] = useState(words[0] ?? "");
  const idxRef = useRef(0);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let stepTimer: ReturnType<typeof setTimeout> | null = null;

    const scrambleTo = (target: string, done: () => void) => {
      let step = 0;
      const total = target.length * 6 + 6;
      const tick = () => {
        if (cancelRef.current) return;
        setDisplay(
          Array.from({ length: target.length }).map((_, i) => {
            if (step >= i * 4 + 8) return target[i];
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          }).join("")
        );
        step++;
        if (step < total) {
          stepTimer = setTimeout(tick, scrambleSpeed);
        } else {
          setDisplay(target);
          done();
        }
      };
      tick();
    };

    const loop = () => {
      if (cancelRef.current) return;
      holdTimer = setTimeout(() => {
        const next = (idxRef.current + 1) % words.length;
        scrambleTo(words[next], () => {
          idxRef.current = next;
          loop();
        });
      }, holdMs);
    };

    loop();

    return () => {
      cancelRef.current = true;
      if (holdTimer) clearTimeout(holdTimer);
      if (stepTimer) clearTimeout(stepTimer);
    };
  }, [words, holdMs, scrambleSpeed]);

  return <>{display}</>;
}

/* ─── (no orb background — FluidShader handles atmosphere) ───────── */

/* ─── Navbar ──────────────────────────────────────────────────────── */
function Navbar() {
  const { scrollY } = useScroll();
  const [sweepKey, setSweepKey] = useState(0);
  const scrolledRef = useRef(false);

  // Smooth morph in both directions, but FAST tween going UP (~200ms ease-out)
  // and a soft spring going DOWN — feels premium instead of janky.
  const smoothY = useMotionValue(0);
  const lastYRef = useRef(0);
  useEffect(() => {
    let controls: ReturnType<typeof animate> | null = null;
    const unsub = scrollY.on("change", v => {
      controls?.stop();
      if (v < lastYRef.current) {
        controls = animate(smoothY, v, { duration: 0.22, ease: [0.22, 1, 0.36, 1] });
      } else {
        controls = animate(smoothY, v, { type: "spring", stiffness: 120, damping: 26, mass: 0.6 });
      }
      lastYRef.current = v;
    });
    return () => { controls?.stop(); unsub(); };
  }, [scrollY, smoothY]);

  // Dead-zone first: 0-60px = pristine pill-less navbar (no visible morph from
  // tiny scroll deltas / overscroll bounce). Morph runs 60-200px for a long,
  // gentle ease so micro-cursor drags never twitch the chrome.
  const navPadY  = useTransform(smoothY, [60, 200], [24, 12],   { clamp: true });
  const navBg    = useTransform(smoothY, [60, 200], ["rgba(20,20,28,0)", "rgba(18,18,26,0.88)"], { clamp: true });
  const navBord  = useTransform(smoothY, [60, 200], ["rgba(255,255,255,0)", "rgba(255,255,255,0.08)"], { clamp: true });
  const navRad   = useTransform(smoothY, [60, 200], [0, 16],    { clamp: true });
  const navPadX  = useTransform(smoothY, [60, 200], [0, 20],    { clamp: true });
  const navBlur  = useTransform(smoothY, [60, 200], ["blur(0px) saturate(100%)", "blur(16px) saturate(140%)"], { clamp: true });
  const navShadow = useTransform(smoothY, [60, 200], [
    "0 0 0 rgba(0,0,0,0)",
    "0 1px 0 rgba(255,255,255,0.04) inset, 0 18px 40px rgba(0,0,0,0.45)",
  ], { clamp: true });

  // Fire a soft shimmer every time the pill morphs in/out.
  // Hysteresis: trigger up at 130px, down at 90px → comfortably inside the
  // 60-200 morph range so the shimmer fires when the pill is actually visible.
  useEffect(() => {
    const unsub = scrollY.on("change", v => {
      const cur = scrolledRef.current;
      const next = cur ? v > 90 : v > 130;
      if (next !== cur) {
        scrolledRef.current = next;
        setSweepKey(k => k + 1);
      }
    });
    return unsub;
  }, [scrollY]);

  return (
    <motion.nav
      initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease }}
      style={{ position: "fixed", top: 0, width: "100%", zIndex: 50 }}
    >
      <Wrap>
        <motion.div style={{ paddingTop: navPadY, paddingBottom: navPadY }}>
          <motion.div
            style={{
              position: "relative", overflow: "hidden",
              display: "flex", alignItems: "center", justifyContent: "space-between", height: 48,
              background: navBg, border: "1px solid", borderColor: navBord,
              borderRadius: navRad, paddingLeft: navPadX, paddingRight: navPadX,
              backdropFilter: navBlur, WebkitBackdropFilter: navBlur as any,
              boxShadow: navShadow,
            }}
          >
            {/* Soft shimmer — slow, low-opacity, replays only on hysteresis-bounded morph */}
            <motion.div
              key={sweepKey}
              initial={{ x: "-130%", opacity: 0 }}
              animate={{ x: "130%", opacity: [0, 0.5, 0] }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], times: [0, 0.5, 1] }}
              style={{
                position: "absolute", top: 0, bottom: 0, width: "70%",
                background: "linear-gradient(100deg, transparent 0%, rgba(255,255,255,0.025) 35%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.025) 65%, transparent 100%)",
                pointerEvents: "none", mixBlendMode: "screen",
              }}
            />
            <div
              style={{ position:"relative", zIndex: 1, display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%" }}
            >
          <Link href="/">
            <motion.div style={{ display:"flex", alignItems:"center", gap:3, cursor:"pointer" }} whileHover={{ opacity: 0.85 }}>
              <motion.div
                whileHover={{ rotate: -6, scale: 1.06 }}
                transition={{ type: "spring", stiffness: 360, damping: 18 }}
                style={{ width:30, height:30, borderRadius:8, overflow:"hidden", filter:"drop-shadow(0 0 14px rgba(255,255,255,0.2))", flexShrink:0 }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}logo.png`}
                  alt="D3FAULT"
                  style={{ width:"140%", height:"140%", objectFit:"cover", marginLeft:"-20%", marginTop:"-20%" }}
                />
              </motion.div>
              <span style={{ color:"white", fontWeight:600, fontSize:15, letterSpacing:"-0.02em" }}>D3FAULT</span>
            </motion.div>
          </Link>

          <div className="d3-nav-links" style={{ display:"flex", alignItems:"center", gap:4 }}>
            <div className="d3-hide-mobile" style={{ display:"flex", alignItems:"center", gap:4 }}>
            {[
              { label:"Docs", href:"/docs" },
              { label:"Protocol", href:"/protocol" },
              { label:"Security", href:"/security" },
            ].map(item => (
              <Link key={item.label} href={item.href}
                style={{ padding:"8px 14px", fontSize:14, color:"rgba(255,255,255,0.35)", fontWeight:500, textDecoration:"none", transition:"color 0.2s", cursor:"pointer" }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color="white")}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color="rgba(255,255,255,0.35)")}>
                {item.label}
              </Link>
            ))}
            </div>
            <Link href="/app">
              <motion.button
                whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
                transition={{ type:"spring", stiffness:500, damping:30 }}
                style={{ marginLeft:12, background:"white", color:"black", padding:"8px 16px", fontSize:14, fontWeight:600, borderRadius:12, border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}
                data-testid="button-launch-app-nav"
              >
                Launch App <ArrowRight style={{ width:14, height:14 }} />
              </motion.button>
            </Link>
          </div>
            </div>
          </motion.div>
        </motion.div>
      </Wrap>
    </motion.nav>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────── */
const PRIVACY_WORDS = ["unlinked", "hidden", "unseen", "secure", "private"];

function Hero() {
  const [triggered, setTriggered] = useState(false);
  const scrambled = useScramble("D3FAULT", triggered, 26);
  useEffect(() => { const t = setTimeout(() => setTriggered(true), 300); return () => clearTimeout(t); }, []);

  return (
    <section style={{ position:"relative", minHeight:"100svh", zIndex:1, overflow:"hidden", display:"flex", flexDirection:"column", justifyContent:"center" }}>
      {/* Fluid shader — very prominent, fills the hero */}
      <FluidShader strength={1.0} />
      {/* Vignette: bottom dark fade + radial centre darkness so text reads cleanly */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none",
        background:"radial-gradient(ellipse 80% 60% at 50% 40%, transparent 30%, rgba(0,0,0,0.45) 100%), linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 30%, transparent 65%, rgba(0,0,0,0.75) 100%)" }} />
      <Wrap className="d3-hero-wrap" style={{ paddingTop: 144, paddingBottom: 100, position:"relative", zIndex:2 }}>
        {/* Giant scramble headline */}
        <motion.h1 className="d3-hero-h1" initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:0.3, delay:0.15 }}
          style={{ fontSize:"clamp(72px, 12vw, 160px)", fontWeight:700, letterSpacing:"-0.04em", lineHeight:0.88, marginBottom:48, color:"white", userSelect:"none" }}>
          {scrambled}
        </motion.h1>

        {/* Subline + CTAs */}
        <motion.div className="d3-hero-row" initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, ease, delay:0.5 }}
          style={{ display:"flex", flexWrap:"wrap", alignItems:"flex-end", gap:48 }}>
          <p className="d3-hero-sub" style={{ fontSize:22, color:"rgba(255,255,255,0.62)", lineHeight:1.4, fontWeight:400, maxWidth:520, margin:0, letterSpacing:"-0.01em" }}>
            Swap with privacy,<br />
            transfers that are{" "}
            <span style={{
              display:"inline-block",
              minWidth:"5.6ch",
              fontFamily:"'JetBrains Mono', ui-monospace, monospace",
              fontWeight:500,
              color:"white",
              letterSpacing:"-0.005em",
            }}>
              <CycleScramble words={PRIVACY_WORDS} holdMs={1000} scrambleSpeed={22} />
            </span>
          </p>
          <div className="d3-hero-cta" style={{ display:"flex", gap:12, flexShrink:0 }}>
            <Link href="/app" data-testid="link-launch-terminal-hero">
              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.96 }}
                transition={{ type:"spring", stiffness:400, damping:25 }}
                style={{ background:"white", color:"black", padding:"14px 32px", fontSize:15, fontWeight:600, borderRadius:12, border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}
                data-testid="button-launch-terminal-hero">
                Launch App <ArrowRight style={{ width:16, height:16 }} />
              </motion.button>
            </Link>
            <a href="https://solscan.io/account/2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG" target="_blank" rel="noreferrer" style={{ textDecoration:"none" }} data-testid="link-program-hero">
              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.96 }}
                transition={{ type:"spring", stiffness:400, damping:25 }}
                style={{ border:"1px solid rgba(255,255,255,0.12)", background:"rgba(22,22,30,0.97)", padding:"14px 26px", fontSize:14.5, fontWeight:500, color:"rgba(255,255,255,0.85)", borderRadius:12, cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8 }}
                data-testid="button-program-hero">
                Onchain Program
              </motion.button>
            </a>
          </div>
        </motion.div>

        {/* Divider */}
        <motion.div initial={{ scaleX:0, opacity:0 }} animate={{ scaleX:1, opacity:1 }}
          transition={{ duration:1.4, ease, delay:0.9 }}
          style={{ height:1, marginTop:72, marginBottom:0, background:"linear-gradient(to right, rgba(255,255,255,0.14), rgba(255,255,255,0.04), transparent)", transformOrigin:"left" }} />

        {/* Technical spec line — text only, premium */}
        <motion.div className="d3-hero-spec" initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, ease, delay:1.1 }}
          style={{ marginTop:36, display:"flex", flexWrap:"wrap", alignItems:"baseline", columnGap:44, rowGap:24 }}>
          {[
            { eyebrow:"Program",   value:"Immutable",   detail:"no upgrade authority" },
            { eyebrow:"Relayer",   value:"Stateless",   detail:"zero server logs" },
            { eyebrow:"Custody",   value:"Self",        detail:"no admin keys" },
            { eyebrow:"Finality",  value:"<400ms",      detail:"single-slot p50" },
          ].map((s, i) => (
            <motion.div key={s.eyebrow}
              initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.5, ease, delay:1.15 + i*0.06 }}
              style={{ display:"flex", flexDirection:"column", gap:7, minWidth:140 }}>
              <span style={{
                fontSize:9.5, fontWeight:600, color:"rgba(255,255,255,0.32)",
                letterSpacing:"0.22em", textTransform:"uppercase",
                fontFamily:"'JetBrains Mono', ui-monospace, monospace",
              }}>
                {s.eyebrow}
              </span>
              <span style={{
                fontSize:20, fontWeight:600, color:"white",
                letterSpacing:"-0.025em", lineHeight:1,
              }}>
                {s.value}
              </span>
              <span style={{
                fontSize:11.5, color:"rgba(255,255,255,0.4)", fontWeight:400,
                letterSpacing:"-0.005em", lineHeight:1.3,
              }}>
                {s.detail}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </Wrap>
    </section>
  );
}

/* ─── Ticker ──────────────────────────────────────────────────────── */
function Ticker() {
  const items = ["Zero custody","Zero logs","Non-custodial","100% on-chain","Sub-second finality","SHA-256 commitments","Program-derived accounts","No admin keys","Fully open-source"];
  const full = [...items, ...items, ...items];
  return (
    <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", borderBottom:"1px solid rgba(255,255,255,0.06)", padding:"20px 0", overflow:"hidden", position:"relative", zIndex:1 }}>
      <div style={{ position:"absolute", left:0, top:0, width:80, height:"100%", background:"linear-gradient(to right, black, transparent)", zIndex:10, pointerEvents:"none" }} />
      <div style={{ position:"absolute", right:0, top:0, width:80, height:"100%", background:"linear-gradient(to left, black, transparent)", zIndex:10, pointerEvents:"none" }} />
      <motion.div animate={{ x:["0%","-33.333%"] }} transition={{ duration:40, repeat:Infinity, ease:"linear" }}
        style={{ display:"flex", whiteSpace:"nowrap" }}>
        {full.map((item,i) => (
          <div key={i} style={{ display:"flex", alignItems:"center", gap:28, flexShrink:0, padding:"0 28px" }}>
            <span style={{ fontSize:14, fontWeight:500, color:"rgba(255,255,255,0.28)" }}>{item}</span>
            <span style={{ width:4, height:4, borderRadius:"50%", background:"rgba(255,255,255,0.14)", flexShrink:0 }} />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/* ─── Split section ───────────────────────────────────────────────── */
function SplitSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once:true, margin:"-80px" });

  return (
    <section ref={ref} className="d3-split-sec d3-sec-pad" style={{ position:"relative", paddingTop:160, paddingBottom:160, zIndex:1, overflow:"hidden" }}>
      {/* Subtle fluid texture on this section */}
      <FluidShader strength={0.22} interactive={false} />
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.72)", pointerEvents:"none" }} />
      <Wrap style={{ position:"relative", zIndex:2 }}>
        <div className="d3-split-grid" style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(320px, 1fr))", gap:80, alignItems:"stretch" }}>
          {/* Left */}
          <div>
            <motion.p initial={{ opacity:0, y:12 }} animate={inView?{opacity:1,y:0}:{}}
              transition={{ duration:0.5, ease }}
              style={{ fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.25)", textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:24, marginTop:0 }}>
              The Problem
            </motion.p>
            <motion.h2 initial={{ opacity:0, y:20 }} animate={inView?{opacity:1,y:0}:{}}
              transition={{ duration:0.7, ease, delay:0.05 }}
              style={{ fontSize:"clamp(36px, 4vw, 52px)", fontWeight:700, color:"white", letterSpacing:"-0.03em", lineHeight:1.08, marginBottom:32, marginTop:0 }}>
              Public chain.<br />
              <span style={{ color:"rgba(255,255,255,0.32)" }}>Private path.</span>
            </motion.h2>
            <motion.p initial={{ opacity:0, y:16 }} animate={inView?{opacity:1,y:0}:{}}
              transition={{ duration:0.7, ease, delay:0.1 }}
              style={{ fontSize:15, color:"rgba(255,255,255,0.4)", fontWeight:300, lineHeight:1.8, marginBottom:40, marginTop:0 }}>
              Every transaction on Solana is permanently public — your wallet, your history,
              your counterparties, all readable by anyone. D3FAULT severs that link with
              SHA-256 commitments, making the path between sender and receiver
              mathematically impossible to trace.
            </motion.p>

            <motion.div initial={{ opacity:0, y:16 }} animate={inView?{opacity:1,y:0}:{}}
              transition={{ duration:0.7, ease, delay:0.15 }}
              style={{ display:"flex", flexDirection:"column", gap:16 }}>
              {[
                { Icon:Eye, label:"On-chain data reveals zero recipient information" },
                { Icon:Shield, label:"SHA-256 commitments break deposit-to-withdrawal links" },
                { Icon:Zap, label:"Relayer covers gas — withdraw to unfunded wallets" },
              ].map(({ Icon, label }) => (
                <div key={label} style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{ width:38, height:38, borderRadius:11, border:"1px solid rgba(255,255,255,0.1)", background:"linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.015))", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 1px 0 rgba(255,255,255,0.06) inset" }}>
                    <Icon style={{ width:15, height:15, color:"rgba(255,255,255,0.55)" }} />
                  </div>
                  <span style={{ fontSize:14, color:"rgba(255,255,255,0.55)", fontWeight:400, lineHeight:1.55, letterSpacing:"-0.005em" }}>{label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right */}
          <motion.div initial={{ opacity:0, x:32 }} animate={inView?{opacity:1,x:0}:{}}
            transition={{ duration:0.9, ease, delay:0.1 }}>
            <PrivacyCard />
          </motion.div>
        </div>
      </Wrap>
    </section>
  );
}

/* ─── Privacy card ────────────────────────────────────────────────── */
function PrivacyCard() {
  const [step, setStep] = useState(0);
  useEffect(() => { const t = setInterval(() => setStep(s => (s+1) % 5), 1700); return () => clearInterval(t); }, []);

  const rows = [
    { label:"Generate secret",    detail:"0xa7f2…b91c" },
    { label:"Commit on-chain",    detail:"sha256(s) → program" },
    { label:"Share sealed link",  detail:"d3fault.sh/c/…" },
    { label:"Relayer pays gas",   detail:"0 SOL needed" },
    { label:"Settle to wallet",   detail:"unlinkable ✓" },
  ];

  const pct = Math.round(((step + 1) / rows.length) * 100);

  return (
    <div className="d3-privacy-card" style={{
      position:"relative", borderRadius:16, overflow:"hidden",
      border:"1px solid rgba(255,255,255,0.07)",
      background:"rgba(14,14,18,0.55)",
      padding:"32px 32px 28px 32px",
      display:"flex", flexDirection:"column", height:"100%",
      transition:"border-color 0.3s ease, background 0.3s ease, box-shadow 0.3s ease",
      boxShadow:"0 0 60px rgba(255,255,255,0.025), 0 24px 56px rgba(0,0,0,0.45)",
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)";
        e.currentTarget.style.background = "rgba(20,20,26,0.72)";
        e.currentTarget.style.boxShadow = "0 0 80px rgba(255,255,255,0.05), 0 28px 64px rgba(0,0,0,0.55)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
        e.currentTarget.style.background = "rgba(14,14,18,0.55)";
        e.currentTarget.style.boxShadow = "0 0 60px rgba(255,255,255,0.025), 0 24px 56px rgba(0,0,0,0.45)";
      }}>
      {/* Corner glow */}
      <div style={{ position:"absolute", top:-80, right:-80, width:220, height:220, background:"radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 65%)", pointerEvents:"none" }} />

      {/* Header */}
      <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:22 }}>
        <span style={{ fontSize:15, fontWeight:600, color:"white", letterSpacing:"-0.02em" }}>Private Transfer</span>
        <div style={{
          display:"inline-flex", alignItems:"center", gap:6,
          padding:"5px 10px", borderRadius:999,
          border:"1px solid rgba(255,255,255,0.1)",
          background:"rgba(255,255,255,0.03)",
        }}>
          <span style={{ position:"relative", display:"inline-flex", width:5, height:5 }}>
            <span style={{ position:"absolute", inset:-2, borderRadius:"50%", background:"rgba(255,255,255,0.18)", animation:"pulse 2s ease-in-out infinite" }} />
            <span style={{ position:"relative", width:5, height:5, borderRadius:"50%", background:"white", boxShadow:"0 0 8px rgba(255,255,255,0.7)" }} />
          </span>
          <span style={{ fontSize:10, fontWeight:600, color:"rgba(255,255,255,0.85)", letterSpacing:"0.1em", textTransform:"uppercase" }}>Mainnet</span>
        </div>
      </div>

      {/* Steps — no icons, just numbers + label + mono detail */}
      <div style={{ position:"relative", display:"flex", flexDirection:"column", gap:8, flex:1, justifyContent:"center" }}>
        {rows.map(({ label, detail }, i) => {
          const done = i <= step;
          const active = i === step;
          const num = String(i + 1).padStart(2, "0");
          return (
            <div key={label} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between",
              padding:"13px 16px", borderRadius:12,
              border:`1px solid ${active ? "rgba(255,255,255,0.18)" : done ? "rgba(255,255,255,0.09)" : "rgba(255,255,255,0.04)"}`,
              background: active
                ? "linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))"
                : done ? "rgba(255,255,255,0.022)" : "rgba(255,255,255,0.006)",
              boxShadow: active ? "0 0 0 1px rgba(255,255,255,0.04) inset, 0 8px 20px rgba(0,0,0,0.25)" : "none",
              transition:"all 0.55s cubic-bezier(0.22,1,0.36,1)",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:14, minWidth:0 }}>
                <span style={{
                  fontSize:10, fontWeight:600,
                  color: done ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)",
                  letterSpacing:"0.12em",
                  fontFamily:"'JetBrains Mono', ui-monospace, monospace",
                  transition:"color 0.55s ease",
                  width:18, flexShrink:0,
                }}>{num}</span>
                <span style={{
                  fontSize:13.5, fontWeight:500,
                  color: done ? "rgba(255,255,255,0.88)" : "rgba(255,255,255,0.42)",
                  letterSpacing:"-0.01em",
                  transition:"color 0.55s ease",
                }}>{label}</span>
              </div>
              <span style={{
                fontFamily:"'JetBrains Mono', ui-monospace, monospace",
                fontSize:11, fontWeight:500,
                color: done ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)",
                transition:"color 0.55s ease",
                whiteSpace:"nowrap",
              }}>{detail}</span>
            </div>
          );
        })}
      </div>

      {/* Progress + meta */}
      <div style={{ position:"relative", marginTop:24 }}>
        <div style={{ height:2, background:"rgba(255,255,255,0.05)", borderRadius:999, overflow:"hidden" }}>
          <motion.div style={{
            height:"100%", borderRadius:999,
            background:"linear-gradient(90deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.9) 100%)",
            boxShadow:"0 0 12px rgba(255,255,255,0.45)",
          }}
            animate={{ width:`${pct}%` }} transition={{ duration:0.9, ease }} />
        </div>
        <div style={{ marginTop:12, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontSize:10, color:"rgba(255,255,255,0.35)", fontWeight:600, letterSpacing:"0.14em", textTransform:"uppercase", fontFamily:"'JetBrains Mono', ui-monospace, monospace" }}>
            {step + 1 < rows.length ? "Settling on-chain" : "Confirmed"}
          </span>
          <span style={{ fontFamily:"'JetBrains Mono', ui-monospace, monospace", fontSize:11, color:"rgba(255,255,255,0.7)", fontWeight:600, letterSpacing:"-0.01em" }}>{pct}%</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Features bento — premium, mirrors actual app capabilities ──── */
type Feature = {
  Icon: typeof Shield;
  eyebrow: string;
  title: string;
  desc: string;
  meta?: string;
  span?: 1 | 2;
  glow?: string;
};

function Features() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once:true, margin:"-60px" });

  const features: Feature[] = [
    {
      Icon: Wallet, eyebrow: "Embedded wallet",
      title: "Sign in. Get a Solana wallet.",
      desc: "Privy provisions a self-custodial wallet on connect. No extension. No seed phrase.",
      meta: "Privy", span: 2, glow: "rgba(140,90,255,0.10)",
    },
    {
      Icon: Repeat, eyebrow: "Routing",
      title: "Jupiter v6 swaps.",
      desc: "Best route across 30+ DEXs, through privacy.",
      span: 1, glow: "rgba(80,180,255,0.08)",
    },
    {
      Icon: Shield, eyebrow: "Commitment",
      title: "SHA-256 break.",
      desc: "Funds lock into a PDA. Deposit ↔ withdrawal link severed.",
      meta: "2akv…mfKG", span: 1, glow: "rgba(140,255,180,0.06)",
    },
    {
      Icon: Zap, eyebrow: "Relayer",
      title: "Recipients pay zero gas.",
      desc: "We front every withdrawal fee. Claim to a wallet with 0 SOL.",
      span: 1, glow: "rgba(255,200,80,0.07)",
    },
    {
      Icon: RotateCcw, eyebrow: "Reclaim",
      title: "Never stuck.",
      desc: "Unclaimed link? Reclaim it back with your original secret.",
      span: 1, glow: "rgba(255,120,140,0.07)",
    },
    {
      Icon: BarChart3, eyebrow: "Portfolio",
      title: "Local-only analytics.",
      desc: "USD-weighted P&L · 7d activity · allocation. Computed in-browser.",
      span: 1, glow: "rgba(120,200,255,0.07)",
    },
    {
      Icon: Code2, eyebrow: "Open protocol",
      title: "No admin keys. Fork it.",
      desc: "Immutable, auditable, mainnet-live. Sub-second finality.",
      span: 2, glow: "rgba(180,180,180,0.05)",
    },
  ];

  return (
    <section ref={ref} className="d3-sec-pad" style={{ position:"relative", paddingTop:112, paddingBottom:112, zIndex:1 }}>
      <Wrap>
        <motion.div initial={{ opacity:0, y:16 }} animate={inView?{opacity:1,y:0}:{}} transition={{ duration:0.7, ease }}
          style={{ marginBottom:44, maxWidth:640 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"4px 12px", borderRadius:999, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.025)", marginBottom:18 }}>
            <span style={{ fontSize:10.5, fontWeight:600, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.14em" }}>Built different</span>
          </div>
          <h2 style={{ fontSize:"clamp(28px, 3.4vw, 40px)", fontWeight:700, color:"white", letterSpacing:"-0.03em", lineHeight:1.1, margin:"0 0 12px 0" }}>
            One app. <span style={{ color:"rgba(255,255,255,0.36)" }}>Every privacy primitive.</span>
          </h2>
          <p style={{ fontSize:14, color:"rgba(255,255,255,0.4)", fontWeight:300, lineHeight:1.65, margin:0, maxWidth:520 }}>
            Wallet, swap, send, reclaim, portfolio. All wired to one immutable on-chain program.
          </p>
        </motion.div>

        <div className="d3-features-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12 }}>
          {features.map((f, i) => (
            <motion.div key={i}
              initial={{ opacity:0, y:20 }} animate={inView?{opacity:1,y:0}:{}}
              transition={{ delay:i*0.05, duration:0.65, ease }}
              whileHover={{ y:-3 }}
              style={{
                gridColumn: `span ${f.span ?? 1}`,
                position:"relative", borderRadius:16,
                border:"1px solid rgba(255,255,255,0.07)",
                padding:20, background:"rgba(14,14,18,0.55)",
                cursor:"default", overflow:"hidden",
                transition:"border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease",
              }}
              onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor="rgba(255,255,255,0.16)"; d.style.background="rgba(20,20,26,0.72)"; d.style.boxShadow=`0 0 48px ${f.glow ?? "rgba(255,255,255,0.04)"}, 0 16px 32px rgba(0,0,0,0.4)`; }}
              onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor="rgba(255,255,255,0.07)"; d.style.background="rgba(14,14,18,0.55)"; d.style.boxShadow="none"; }}
            >
              {/* Corner glow */}
              <div style={{ position:"absolute", top:-60, right:-60, width:160, height:160, background:`radial-gradient(circle, ${f.glow ?? "rgba(255,255,255,0.04)"} 0%, transparent 65%)`, pointerEvents:"none" }} />
              {/* Header row: icon + eyebrow + meta */}
              <div style={{ position:"relative", display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <div style={{ width:30, height:30, borderRadius:8, border:"1px solid rgba(255,255,255,0.12)", background:"linear-gradient(160deg, rgba(255,255,255,0.06), rgba(255,255,255,0.015))", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, boxShadow:"0 1px 0 rgba(255,255,255,0.06) inset" }}>
                  <f.Icon style={{ width:13, height:13, color:"rgba(255,255,255,0.75)" }} strokeWidth={1.7} />
                </div>
                <div style={{ fontSize:9.5, fontWeight:600, color:"rgba(255,255,255,0.36)", textTransform:"uppercase", letterSpacing:"0.14em" }}>{f.eyebrow}</div>
                {f.meta && (
                  <div style={{ marginLeft:"auto", fontSize:9.5, color:"rgba(255,255,255,0.32)", fontWeight:500, fontFamily:"'JetBrains Mono', ui-monospace, monospace", padding:"3px 8px", borderRadius:5, background:"rgba(0,0,0,0.4)", border:"1px solid rgba(255,255,255,0.05)" }}>
                    {f.meta}
                  </div>
                )}
              </div>
              {/* Title */}
              <h3 style={{ position:"relative", fontSize: f.span === 2 ? 16 : 14.5, fontWeight:600, color:"white", letterSpacing:"-0.015em", lineHeight:1.3, margin:"0 0 6px 0" }}>{f.title}</h3>
              {/* Desc */}
              <p style={{ position:"relative", fontSize:12.5, color:"rgba(255,255,255,0.42)", lineHeight:1.55, fontWeight:300, margin:0 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </Wrap>
    </section>
  );
}

/* ─── How it works — premium 4-step flow mirroring the real app ──── */
type Step = {
  n: string;
  Icon: typeof Wallet;
  eyebrow: string;
  title: string;
  desc: string;
  detail: string;
  glow: string;
  href?: string;
  hrefLabel?: string;
};

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once:true, margin:"-60px" });

  const steps: Step[] = [
    {
      n:"01", Icon: Wallet, eyebrow: "Connect",
      title: "Sign in — Solana wallet appears.",
      desc: "Privy authenticates and provisions a self-custodial wallet in one tap.",
      detail: "One tap · Self-custodial",
      glow: "rgba(140,90,255,0.10)",
      href: "/app/wallet", hrefLabel: "Wallet",
    },
    {
      n:"02", Icon: Repeat, eyebrow: "Trade",
      title: "Swap with privacy via Jupiter.",
      desc: "Funds detour through an ephemeral wallet, route via Jupiter, settle silently.",
      detail: "Best route · ~400ms",
      glow: "rgba(80,180,255,0.10)",
      href: "/app/swap", hrefLabel: "Swap",
    },
    {
      n:"03", Icon: Send, eyebrow: "Send",
      title: "Direct or private secret-link.",
      desc: "Direct on-chain, or SHA-256 commitment with a one-time secret link.",
      detail: "Two modes · One UI",
      glow: "rgba(140,255,180,0.09)",
      href: "/app/send", hrefLabel: "Send",
    },
    {
      n:"04", Icon: KeyRound, eyebrow: "Claim · Reclaim",
      title: "Gas-free claim. Reversible reclaim.",
      desc: "Relayer covers withdrawal gas. Unclaimed link? Reclaim with the secret.",
      detail: "Zero SOL · Never stuck",
      glow: "rgba(255,200,80,0.10)",
      href: "/claim", hrefLabel: "Claim",
    },
  ];

  return (
    <section ref={ref} className="d3-sec-pad" style={{ position:"relative", paddingTop:112, paddingBottom:112, zIndex:1, overflow:"hidden" }}>
      {/* faint shader wash */}
      <FluidShader strength={0.18} interactive={false} />
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.78)", pointerEvents:"none" }} />

      <Wrap style={{ position:"relative", zIndex:2 }}>
        {/* Section header */}
        <motion.div initial={{ opacity:0, y:16 }} animate={inView?{opacity:1,y:0}:{}} transition={{ duration:0.7, ease }}
          style={{ marginBottom:44, maxWidth:640 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"4px 11px", borderRadius:999, border:"1px solid rgba(255,255,255,0.08)", background:"rgba(255,255,255,0.025)", marginBottom:18 }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background:"rgba(140,255,180,0.7)", boxShadow:"0 0 8px rgba(140,255,180,0.5)" }} />
            <span style={{ fontSize:10.5, fontWeight:600, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.12em" }}>How it works</span>
          </div>
          <h2 style={{ fontSize:"clamp(28px, 3.4vw, 40px)", fontWeight:700, color:"white", letterSpacing:"-0.03em", lineHeight:1.1, margin:"0 0 12px 0" }}>
            Four steps. <span style={{ color:"rgba(255,255,255,0.36)" }}>Signed-in to settled.</span>
          </h2>
          <p style={{ fontSize:14, color:"rgba(255,255,255,0.4)", fontWeight:300, lineHeight:1.65, margin:0, maxWidth:520 }}>
            Every action passes through the same immutable on-chain program.
          </p>
        </motion.div>

        {/* Steps as 4-up grid (compact) */}
        <div className="d3-howit-grid" style={{ position:"relative", display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:12 }}>

          {steps.map((step, i) => (
            <motion.div key={i}
              initial={{ opacity:0, y:16 }} animate={inView?{opacity:1,y:0}:{}}
              transition={{ delay:0.1+i*0.1, duration:0.6, ease }}
              whileHover={{ y:-3 }}
              style={{
                position:"relative", zIndex:1,
                padding:18,
                borderRadius:14,
                border:"1px solid rgba(255,255,255,0.07)",
                background:"rgba(14,14,18,0.55)",
                cursor:"default", overflow:"hidden",
                transition:"border-color 0.25s ease, background 0.25s ease, box-shadow 0.25s ease",
              }}
              onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor="rgba(255,255,255,0.16)"; d.style.background="rgba(20,20,26,0.72)"; d.style.boxShadow=`0 0 48px ${step.glow}, 0 16px 32px rgba(0,0,0,0.4)`; }}
              onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor="rgba(255,255,255,0.07)"; d.style.background="rgba(14,14,18,0.55)"; d.style.boxShadow="none"; }}
            >
              {/* Faint corner color glow — same trick as Built Different */}
              <div style={{ position:"absolute", top:-60, right:-60, width:180, height:180, background:`radial-gradient(circle, ${step.glow} 0%, transparent 65%)`, pointerEvents:"none" }} />
              {/* Header: step number badge + icon */}
              <div style={{ position:"relative", display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <div style={{ width:28, height:28, borderRadius:8, border:"1px solid rgba(255,255,255,0.12)", background:"linear-gradient(160deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015))", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 1px 0 rgba(255,255,255,0.08) inset" }}>
                  <span style={{ fontSize:11, fontWeight:700, color:"white", fontFamily:"'JetBrains Mono', ui-monospace, monospace", letterSpacing:"-0.02em" }}>{step.n}</span>
                </div>
                <div style={{ width:24, height:24, borderRadius:6, border:"1px solid rgba(255,255,255,0.07)", background:"rgba(255,255,255,0.03)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <step.Icon style={{ width:11, height:11, color:"rgba(255,255,255,0.55)" }} strokeWidth={1.7} />
                </div>
              </div>

              {/* Eyebrow */}
              <div style={{ position:"relative", fontSize:9.5, fontWeight:600, color:"rgba(255,255,255,0.34)", textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:8 }}>{step.eyebrow}</div>
              {/* Title */}
              <h4 style={{ position:"relative", fontSize:14.5, fontWeight:600, color:"white", letterSpacing:"-0.015em", lineHeight:1.3, margin:"0 0 8px 0" }}>{step.title}</h4>
              {/* Desc */}
              <p style={{ position:"relative", fontSize:12.5, color:"rgba(255,255,255,0.42)", fontWeight:300, lineHeight:1.55, margin:"0 0 14px 0" }}>{step.desc}</p>

              {/* Footer: detail tag + arrow link */}
              <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:10, color:"rgba(255,255,255,0.4)", fontFamily:"'JetBrains Mono', ui-monospace, monospace", minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  <span style={{ width:4, height:4, borderRadius:"50%", background:"rgba(140,255,180,0.55)", flexShrink:0 }} />
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>{step.detail}</span>
                </div>
                {step.href && (
                  <Link href={step.href} data-testid={`link-howitworks-step-${i+1}`}>
                    <motion.div
                      whileHover={{ x:2 }}
                      style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10.5, fontWeight:600, color:"rgba(255,255,255,0.7)", cursor:"pointer", flexShrink:0 }}
                    >
                      {step.hrefLabel}
                      <ArrowRight style={{ width:10, height:10 }} strokeWidth={2.2} />
                    </motion.div>
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </Wrap>
    </section>
  );
}

/* ─── Drifting color orb (portfolite-style background mesh) ───────── */
function DriftingOrb({ color, size, from, to, dur, delay = 0 }: {
  color: string; size: number;
  from: { x: string; y: string }; to: { x: string; y: string };
  dur: number; delay?: number;
}) {
  return (
    <motion.div
      initial={{ left: from.x, top: from.y }}
      animate={{ left: [from.x, to.x, from.x], top: [from.y, to.y, from.y] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: "easeInOut" }}
      style={{
        position: "absolute", width: size, height: size,
        borderRadius: "50%", background: color,
        transform: "translate(-50%, -50%)", pointerEvents: "none",
        filter: "blur(8px)",
      }}
    />
  );
}

/* ─── CTA — split layout with portfolite-style drifting orbs ──────── */
function CTA() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once:true, margin:"-60px" });
  const cardRef = useRef<HTMLDivElement>(null);
  const spotX = useMotionValue(50);
  const spotY = useMotionValue(50);

  // Cursor-tracked spotlight (relative to the card)
  useEffect(() => {
    const el = cardRef.current; if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      spotX.set(((e.clientX - r.left) / r.width) * 100);
      spotY.set(((e.clientY - r.top) / r.height) * 100);
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, [spotX, spotY]);

  // Spotlight gradient string driven by the motion values
  const spotlight = useTransform([spotX, spotY], ([x, y]) =>
    `radial-gradient(420px circle at ${x}% ${y}%, rgba(255,255,255,0.06) 0%, transparent 55%)`
  );

  return (
    <section ref={ref} className="d3-sec-pad-sm" style={{ position:"relative", paddingTop:96, paddingBottom:96, zIndex:1 }}>
      <Wrap>
        <motion.div ref={cardRef} className="d3-cta-card"
          initial={{ opacity:0, y:28 }} animate={inView?{opacity:1,y:0}:{}} transition={{ duration:0.8, ease }}
          style={{
            position:"relative", borderRadius:32, overflow:"hidden",
            border:"1px solid rgba(255,255,255,0.09)",
            background:"linear-gradient(165deg, rgba(14,14,20,0.95) 0%, rgba(8,8,12,0.98) 100%)",
            boxShadow:"0 1px 0 rgba(255,255,255,0.05) inset, 0 48px 120px rgba(0,0,0,0.7)",
            minHeight:520,
          }}>

          {/* ── Drifting orbs — pure white at low opacity (B&W only) ── */}
          <DriftingOrb color="rgba(255,255,255,0.10)" size={520} from={{ x:"-10%", y:"-15%" }} to={{ x:"15%",  y:"10%"  }} dur={18} />
          <DriftingOrb color="rgba(255,255,255,0.07)" size={460} from={{ x:"60%",  y:"70%"  }} to={{ x:"40%",  y:"30%" }} dur={22} delay={2} />
          <DriftingOrb color="rgba(255,255,255,0.06)" size={380} from={{ x:"75%",  y:"-10%" }} to={{ x:"55%",  y:"20%" }} dur={26} delay={4} />
          <DriftingOrb color="rgba(255,255,255,0.05)" size={420} from={{ x:"-15%", y:"75%"  }} to={{ x:"10%",  y:"55%" }} dur={20} delay={1} />

          {/* Heavy blur over the orbs to fuse them into a soft mesh */}
          <div style={{ position:"absolute", inset:0, backdropFilter:"blur(80px)", WebkitBackdropFilter:"blur(80px)", pointerEvents:"none" }} />
          {/* Dark wash for legibility */}
          <div style={{ position:"absolute", inset:0, background:"rgba(6,6,10,0.55)", pointerEvents:"none" }} />
          {/* Cursor spotlight */}
          <motion.div style={{ position:"absolute", inset:0, background:spotlight, pointerEvents:"none" }} />
          {/* Subtle dot-grid overlay */}
          <div style={{ position:"absolute", inset:0, backgroundImage:"radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize:"22px 22px", opacity:0.5, pointerEvents:"none", mixBlendMode:"overlay" }} />
          {/* Top-edge highlight */}
          <div style={{ position:"absolute", top:0, left:"15%", right:"15%", height:1, background:"linear-gradient(to right, transparent, rgba(255,255,255,0.22), transparent)", pointerEvents:"none" }} />

          {/* ── Two-column content ──────────────────────────────────── */}
          <div className="d3-cta-grid" style={{ position:"relative", zIndex:2, display:"grid", gridTemplateColumns:"1.05fr 0.95fr", gap:48, padding:"72px 56px", alignItems:"center" }}>

            {/* LEFT — copy + CTA */}
            <div>
              <h2 className="d3-cta-h2" style={{ fontSize:"clamp(40px, 5.4vw, 68px)", fontWeight:700, color:"white", letterSpacing:"-0.04em", lineHeight:1.02, margin:"0 0 18px 0" }}>
                Move without<br/>a trace.
              </h2>

              <p style={{ fontSize:15.5, color:"rgba(255,255,255,0.5)", fontWeight:300, lineHeight:1.65, margin:"0 0 32px 0", maxWidth:420 }}>
                Self-custodial transfers, swaps, and gas-free claims on Solana. Routed through ephemeral wallets, sealed by SHA-256 commitments.
              </p>

              <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:28, flexWrap:"wrap" }}>
                <Link href="/app" data-testid="link-access-terminal-cta">
                  <motion.button whileHover={{ scale:1.04 }} whileTap={{ scale:0.96 }} transition={{ type:"spring", stiffness:400, damping:25 }}
                    style={{ background:"white", color:"black", padding:"15px 30px", fontSize:14.5, fontWeight:600, borderRadius:12, border:"none", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:10, boxShadow:"0 12px 28px rgba(255,255,255,0.12)" }}
                    data-testid="button-access-terminal-cta">
                    Launch App <ArrowRight style={{ width:15, height:15 }} />
                  </motion.button>
                </Link>
                <Link href="/docs">
                  <motion.button whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}
                    style={{ background:"rgba(255,255,255,0.04)", color:"rgba(255,255,255,0.85)", padding:"15px 26px", fontSize:14, fontWeight:500, borderRadius:12, border:"1px solid rgba(255,255,255,0.12)", cursor:"pointer", display:"inline-flex", alignItems:"center", gap:8 }}>
                    Read the docs
                  </motion.button>
                </Link>
              </div>

              <div style={{ display:"flex", alignItems:"center", gap:18, fontSize:11, color:"rgba(255,255,255,0.34)", fontFamily:"'JetBrains Mono', ui-monospace, monospace", flexWrap:"wrap" }}>
                <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                  <span style={{ width:5, height:5, borderRadius:"50%", background:"rgba(140,255,180,0.7)" }} /> Non-custodial
                </span>
                <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                  <span style={{ width:5, height:5, borderRadius:"50%", background:"rgba(80,180,255,0.7)" }} /> Zero logs
                </span>
                <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                  <span style={{ width:5, height:5, borderRadius:"50%", background:"rgba(255,200,80,0.7)" }} /> Gas-relayed claims
                </span>
              </div>
            </div>

            {/* RIGHT — verified X organization profile card */}
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
              <a href="https://x.com/d3fault_sh" target="_blank" rel="noreferrer" style={{ textDecoration:"none", color:"inherit" }}>
                <div
                  style={{
                    position:"relative", borderRadius:20, overflow:"hidden",
                    border:"1px solid rgba(255,255,255,0.12)",
                    background:"linear-gradient(165deg, rgba(20,20,26,0.78) 0%, rgba(10,10,14,0.9) 100%)",
                    backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
                    boxShadow:"0 1px 0 rgba(255,255,255,0.07) inset, 0 24px 64px rgba(0,0,0,0.55)",
                    cursor:"pointer",
                  }}>
                  {/* Faint gold-tinted corner glow — only color highlight, very subtle */}
                  <div style={{ position:"absolute", top:-80, right:-80, width:240, height:240, background:"radial-gradient(circle, rgba(231,178,63,0.10) 0%, transparent 65%)", pointerEvents:"none" }} />

                  {/* Mock cover band */}
                  <div style={{ height:64, background:"linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)", borderBottom:"1px solid rgba(255,255,255,0.05)", position:"relative" }}>
                    {/* X logo top-right */}
                    <div style={{ position:"absolute", top:14, right:16, color:"rgba(255,255,255,0.55)" }}>
                      <XIcon size={16} />
                    </div>
                  </div>

                  {/* Profile body */}
                  <div style={{ padding:"0 22px 22px 22px", position:"relative" }}>
                    {/* Avatar overlapping cover */}
                    <div style={{
                      width:64, height:64, borderRadius:"50%", overflow:"hidden",
                      border:"3px solid rgba(10,10,14,1)", background:"#0a0a0e",
                      marginTop:-32, marginBottom:12,
                      boxShadow:"0 8px 24px rgba(0,0,0,0.6)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }}>
                      <img src={`${import.meta.env.BASE_URL}logo.png`} alt="D3FAULT"
                        style={{ width:"78%", height:"78%", objectFit:"contain", display:"block" }} />
                    </div>

                    {/* Name + gold tick */}
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                      <span style={{ fontSize:17, fontWeight:700, color:"white", letterSpacing:"-0.02em" }}>D3FAULT</span>
                      <GoldVerifiedTick size={18} />
                    </div>
                    <div style={{ fontSize:13, color:"rgba(255,255,255,0.45)", fontWeight:500, marginBottom:14 }}>@d3fault_sh</div>

                    {/* Bio */}
                    <p style={{ fontSize:13, color:"rgba(255,255,255,0.65)", fontWeight:400, lineHeight:1.55, margin:"0 0 14px 0" }}>
                      Privacy-first execution layer for Solana. Self-custodial wallets, gas-relayed claims, SHA-256 commitments.
                    </p>

                    {/* Verified-org chip + follow CTA */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display:"inline-flex", alignItems:"center", gap:7, padding:"5px 10px", borderRadius:999, border:"1px solid rgba(231,178,63,0.28)", background:"rgba(231,178,63,0.06)" }}>
                        <GoldVerifiedTick size={11} />
                        <span style={{ fontSize:10.5, fontWeight:600, color:"rgba(231,178,63,0.95)", textTransform:"uppercase", letterSpacing:"0.1em" }}>Verified Organization</span>
                      </div>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:6, fontSize:12, fontWeight:600, color:"white" }}>
                        View on X <ArrowRight style={{ width:12, height:12 }} />
                      </span>
                    </div>
                  </div>
                </div>
              </a>

              {/* Caption */}
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.45)", fontWeight:400, margin:0, textAlign:"center", letterSpacing:"-0.005em" }}>
                We are verified as <span style={{ color:"rgba(231,178,63,0.95)", fontWeight:600 }}>Organization</span> on X
              </p>
            </div>
          </div>
        </motion.div>
      </Wrap>
    </section>
  );
}

/* ─── X (formerly Twitter) icon ───────────────────────────────────── */
const XIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

/* ─── Gold "Verified Organization" tick (X-style hex badge) ───────── */
const GoldVerifiedTick = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true" style={{ flexShrink: 0 }}>
    <defs>
      <linearGradient id="d3-gold-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stopColor="#F4CF6A" />
        <stop offset="55%"  stopColor="#E7B23F" />
        <stop offset="100%" stopColor="#B8862A" />
      </linearGradient>
    </defs>
    <path
      fill="url(#d3-gold-grad)"
      d="M11 1.4l2.34 1.95 3.04-.34.92 2.92 2.65 1.55-.86 2.94L21 13.07l-2.06 2.27.55 3.01-2.96.74-1.66 2.56L11.96 20l-2.96 1.66L7.34 19.1l-2.96-.74.55-3.01L2.87 13.07l1.91-2.65L3.92 7.48 6.57 5.93 7.49 3.01l3.04.34L11 1.4z"
    />
    <path
      fill="#fff"
      d="M9.95 14.5l-2.5-2.5 1.06-1.06 1.44 1.44 3.97-3.97L15 9.47l-5.05 5.03z"
    />
  </svg>
);

/* ─── Telegram icon ───────────────────────────────────────────────── */
const TelegramIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.464.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>
);

/* ─── Footer ──────────────────────────────────────────────────────── */
function Footer() {
  const linkStyle: React.CSSProperties = {
    fontSize: 13, color: "rgba(255,255,255,0.4)", textDecoration: "none",
    fontWeight: 500, transition: "color 0.2s ease",
    display: "inline-flex", alignItems: "center", gap: 8,
  };
  const onLinkEnter = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.92)"; };
  const onLinkLeave = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.4)"; };

  return (
    <footer style={{ position:"relative", paddingTop:24, paddingBottom:40, zIndex:1 }}>
      <Wrap>
        {/* Premium glass slab */}
        <div className="d3-footer-card" style={{
          position:"relative", overflow:"hidden",
          borderRadius:24,
          border:"1px solid rgba(255,255,255,0.07)",
          background:"linear-gradient(165deg, rgba(16,16,22,0.88) 0%, rgba(10,10,14,0.92) 100%)",
          padding:"48px 44px 28px 44px",
          boxShadow:"0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 64px rgba(0,0,0,0.5)",
        }}>
          {/* Faint top-edge highlight */}
          <div style={{ position:"absolute", top:0, left:"15%", right:"15%", height:1, background:"linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent)", pointerEvents:"none" }} />
          {/* Soft brand-tinted corner glow */}
          <div style={{ position:"absolute", top:-100, right:-100, width:340, height:340, background:"radial-gradient(circle, rgba(140,90,255,0.06) 0%, transparent 65%)", pointerEvents:"none" }} />

          <div className="d3-footer-grid" style={{ position:"relative", display:"grid", gridTemplateColumns:"1fr auto auto", gap:64, alignItems:"start" }}>
            {/* Brand column */}
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:4, marginBottom:18 }}>
                <div style={{ width:30, height:30, borderRadius:8, overflow:"hidden", flexShrink:0, filter:"drop-shadow(0 0 14px rgba(255,255,255,0.18))" }}>
                  <img src={`${import.meta.env.BASE_URL}logo.png`} alt="D3FAULT" style={{ width:"140%", height:"140%", objectFit:"cover", marginLeft:"-20%", marginTop:"-20%" }} />
                </div>
                <span style={{ fontWeight:600, fontSize:15, color:"white", letterSpacing:"-0.02em" }}>D3FAULT</span>
              </div>
              <p style={{ fontSize:13, color:"rgba(255,255,255,0.55)", fontWeight:400, maxWidth:320, lineHeight:1.6, margin:"0 0 10px 0" }}>
                Private transaction orchestration on Solana.
              </p>
              <p style={{ fontSize:11.5, color:"rgba(255,255,255,0.22)", fontWeight:400, margin:"0 0 22px 0", letterSpacing:"-0.005em" }}>
                Live on Solana mainnet. Every transaction settles on-chain.
              </p>
              <div style={{ display:"inline-flex", alignItems:"center", gap:18 }}>
                {[
                  { href:"https://x.com/d3fault_sh", label:"X", icon:<XIcon size={16} /> },
                  { href:"#", label:"GitHub", icon:<Github style={{ width:16, height:16 }} /> },
                  { href:"#", label:"Telegram", icon:<TelegramIcon size={16} /> },
                ].map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "white"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.transform = "translateY(0)"; }}
                    style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.5)", transition:"all 200ms cubic-bezier(0.22,1,0.36,1)", textDecoration:"none" }}>
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Read column */}
            <div style={{ display:"flex", flexDirection:"column", gap:14, minWidth:120 }}>
              <span style={{ fontSize:10.5, fontWeight:600, color:"rgba(255,255,255,0.32)", textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:6 }}>Read</span>
              <Link href="/docs" style={linkStyle} onMouseEnter={onLinkEnter} onMouseLeave={onLinkLeave}>Docs</Link>
              <a href="https://whitepaper.d3fault.sh" target="_blank" rel="noreferrer" style={linkStyle} onMouseEnter={onLinkEnter} onMouseLeave={onLinkLeave}>Whitepaper</a>
              <a href="https://medium.com/@d3fault" target="_blank" rel="noreferrer" style={linkStyle} onMouseEnter={onLinkEnter} onMouseLeave={onLinkLeave}>Medium</a>
            </div>

            {/* On-chain column */}
            <div style={{ display:"flex", flexDirection:"column", gap:14, minWidth:120 }}>
              <span style={{ fontSize:10.5, fontWeight:600, color:"rgba(255,255,255,0.32)", textTransform:"uppercase", letterSpacing:"0.14em", marginBottom:6 }}>On-chain</span>
              <Link href="/protocol" style={linkStyle} onMouseEnter={onLinkEnter} onMouseLeave={onLinkLeave}>Protocol</Link>
              <Link href="/security" style={linkStyle} onMouseEnter={onLinkEnter} onMouseLeave={onLinkLeave}>Security</Link>
              <a href="https://solscan.io/account/2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG" target="_blank" rel="noreferrer" style={linkStyle} onMouseEnter={onLinkEnter} onMouseLeave={onLinkLeave}>Program</a>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ position:"relative", marginTop:44, paddingTop:22, borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:14 }}>
            <span style={{ fontSize:12, color:"rgba(255,255,255,0.28)", fontWeight:500, letterSpacing:"-0.005em" }}>
              &copy; {new Date().getFullYear()} D3FAULT Protocol · Open-source MIT
            </span>
            <div style={{ display:"flex", alignItems:"center", gap:14, fontSize:11, color:"rgba(255,255,255,0.3)", fontWeight:500, fontFamily:"'JetBrains Mono', ui-monospace, monospace" }}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:"rgba(140,255,180,0.7)" }} />
                Non-custodial
              </span>
              <span style={{ width:3, height:3, borderRadius:"50%", background:"rgba(255,255,255,0.18)" }} />
              <span>Zero logs</span>
              <span style={{ width:3, height:3, borderRadius:"50%", background:"rgba(255,255,255,0.18)" }} />
              <span>Immutable program</span>
            </div>
          </div>
        </div>
      </Wrap>
    </footer>
  );
}

/* ─── Scroll progress (premium top accent) ────────────────────────── */
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

/* ─── Page ────────────────────────────────────────────────────────── */
export default function Home() {
  return (
    <div style={{ minHeight:"100vh", background:"black", color:"white", overflowX:"hidden" }}>
      <ScrollProgress />
      <GrainOverlay />
      <Navbar />
      <Hero />
      <SplitSection />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </div>
  );
}
