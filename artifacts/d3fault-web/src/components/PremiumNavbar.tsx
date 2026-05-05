import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Wallet, Shuffle, Send, Download, Activity, Menu, X as XIcon } from "lucide-react";
import { GLASS, EASE } from "@/lib/theme";

export type NavSection = "wallet" | "swap" | "send" | "receive" | "portfolio";

const TABS: { value: NavSection; href: string; icon: typeof Wallet; label: string }[] = [
  { value: "wallet",     href: "/app/wallet",     icon: Wallet,   label: "Wallet" },
  { value: "swap",       href: "/app/swap",       icon: Shuffle,  label: "Swap" },
  { value: "send",       href: "/app/send",       icon: Send,     label: "Send" },
  { value: "receive",    href: "/app/receive",    icon: Download, label: "Receive" },
  { value: "portfolio",  href: "/app/portfolio",  icon: Activity, label: "Portfolio" },
];

export function PremiumNavbar({ active }: { active: NavSection }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, setLocation] = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile sheet on route change
  useEffect(() => { setMobileOpen(false); }, [active]);

  const blurAmt = scrolled ? "blur(36px) saturate(190%)" : GLASS.blur;

  return (
    <>
      {/* ── DESKTOP: floating glass pill ─────────────────────────────── */}
      <motion.nav
        className="d3-nav-desktop"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: EASE }}
        style={{
          display: "none",
          margin: "0 auto 28px",
          width: "fit-content",
          padding: 5,
          borderRadius: 999,
          background: scrolled ? "rgba(8,8,12,0.78)" : "rgba(10,10,16,0.55)",
          backdropFilter: blurAmt,
          WebkitBackdropFilter: blurAmt,
          border: GLASS.border,
          boxShadow: [
            GLASS.innerHL,
            "0 12px 48px rgba(0,0,0,0.55)",
            "0 1px 0 rgba(0,0,0,0.6)",
          ].join(", "),
          position: "relative",
          zIndex: 50,
          transition: "background 0.3s ease, backdrop-filter 0.3s ease",
        }}
      >
        <ul style={{ display: "flex", gap: 2, listStyle: "none", margin: 0, padding: 0 }}>
          {TABS.map((tab) => {
            const isActive = active === tab.value;
            const Icon = tab.icon;
            return (
              <li key={tab.value} style={{ position: "relative" }}>
                <Link href={tab.href}>
                  <motion.div
                    initial={false}
                    whileHover="hover"
                    whileTap={{ scale: 0.98 }}
                    animate="rest"
                    variants={{ rest: {}, hover: { scale: 1.02 } }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    style={{
                      position: "relative",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 18px",
                      borderRadius: 999,
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      letterSpacing: "0.02em",
                      color: isActive ? "#000" : "rgba(255,255,255,0.55)",
                      transition: "color 0.25s ease",
                      userSelect: "none",
                    }}
                  >
                    {!isActive && (
                      <motion.span
                        aria-hidden
                        variants={{ rest: { opacity: 0 }, hover: { opacity: 1 } }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        style={{
                          position: "absolute", inset: 0, borderRadius: 999,
                          background: "radial-gradient(ellipse at center, rgba(255,255,255,0.10) 0%, transparent 70%)",
                          pointerEvents: "none", zIndex: 0,
                        }}
                      />
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="navActiveIndicator"
                        style={{
                          position: "absolute",
                          inset: 0,
                          borderRadius: 999,
                          background: "linear-gradient(180deg, #ffffff 0%, #e8e8ec 100%)",
                          boxShadow: "0 4px 16px rgba(255,255,255,0.22), 0 1px 0 rgba(255,255,255,0.5) inset, 0 -1px 0 rgba(0,0,0,0.1) inset",
                          zIndex: 0,
                        }}
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <Icon style={{ width: 14, height: 14, position: "relative", zIndex: 1, opacity: isActive ? 1 : 0.55, transition: "opacity 0.2s ease" }} />
                    <span style={{ position: "relative", zIndex: 1 }}>{tab.label}</span>
                    {/* moving underline indicator beneath the active tab */}
                    {isActive && (
                      <motion.span
                        layoutId="navActiveUnderline"
                        style={{
                          position: "absolute",
                          bottom: -8,
                          left: "30%",
                          right: "30%",
                          height: 2,
                          borderRadius: 2,
                          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                          zIndex: 2,
                        }}
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                  </motion.div>
                </Link>
              </li>
            );
          })}
        </ul>
      </motion.nav>

      {/* ── MOBILE: hamburger trigger ────────────────────────────────── */}
      <motion.button
        className="d3-nav-mobile-btn"
        onClick={() => setMobileOpen(true)}
        whileTap={{ scale: 0.94 }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
        aria-label="Open menu"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          margin: "0 auto 24px",
          padding: "12px 18px",
          borderRadius: 999,
          background: "rgba(10,10,16,0.6)",
          backdropFilter: GLASS.blur,
          WebkitBackdropFilter: GLASS.blur,
          border: GLASS.border,
          boxShadow: [GLASS.innerHL, GLASS.shadowDeep].join(", "),
          cursor: "pointer",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: "0.02em",
          width: "fit-content",
        }}
      >
        <Menu style={{ width: 16, height: 16 }} />
        <span style={{ textTransform: "capitalize" }}>{active}</span>
      </motion.button>

      {/* ── MOBILE: full-screen sheet ────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setMobileOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.6)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                zIndex: 90,
              }}
            />
            {/* Sheet */}
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ duration: 0.32, ease: EASE }}
              style={{
                position: "fixed",
                top: 24,
                left: 16,
                right: 16,
                zIndex: 100,
                padding: 14,
                borderRadius: 22,
                background: "rgba(12,12,18,0.85)",
                backdropFilter: "blur(40px) saturate(200%)",
                WebkitBackdropFilter: "blur(40px) saturate(200%)",
                border: GLASS.borderHi,
                boxShadow: [GLASS.innerHL, "0 24px 80px rgba(0,0,0,0.7)"].join(", "),
                maxWidth: 420,
                margin: "0 auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Navigation</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                  style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 999, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
                >
                  <XIcon style={{ width: 16, height: 16 }} />
                </button>
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: "10px 0 4px", display: "flex", flexDirection: "column", gap: 4 }}>
                {TABS.map((tab) => {
                  const isActive = active === tab.value;
                  const Icon = tab.icon;
                  return (
                    <li key={tab.value}>
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setLocation(tab.href); setMobileOpen(false); }}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          gap: 14,
                          padding: "14px 16px",
                          borderRadius: 14,
                          background: isActive ? "rgba(255,255,255,0.10)" : "transparent",
                          border: isActive ? "1px solid rgba(255,255,255,0.14)" : "1px solid transparent",
                          color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
                          fontSize: 15,
                          fontWeight: isActive ? 700 : 500,
                          letterSpacing: "0.01em",
                          cursor: "pointer",
                          transition: "background 0.2s ease, color 0.2s ease",
                          textAlign: "left",
                        }}
                      >
                        <span style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: isActive ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          flexShrink: 0,
                        }}>
                          <Icon style={{ width: 16, height: 16 }} />
                        </span>
                        <span>{tab.label}</span>
                      </motion.button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        @media (min-width: 768px) {
          .d3-nav-desktop { display: flex !important; }
          .d3-nav-mobile-btn { display: none !important; }
        }
      `}</style>
    </>
  );
}
