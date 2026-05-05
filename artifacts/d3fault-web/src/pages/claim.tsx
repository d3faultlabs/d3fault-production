import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { usePrivy } from "@privy-io/react-auth";
import { Lock, CheckCircle2, AlertTriangle, Shield, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GrainOverlay } from "@/components/GrainOverlay";
import { useRelayWithdraw } from "@workspace/api-client-react";
import { parseClaimHash, computeCommitment, toHex } from "@workspace/d3fault-shared";
import { PublicKey } from "@solana/web3.js";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const _CLAIM_NETWORK = (import.meta.env.VITE_SOLANA_NETWORK ?? "devnet") as string;
const CLAIM_EXPLORER_CLUSTER = _CLAIM_NETWORK === "mainnet-beta" ? "" : `?cluster=${_CLAIM_NETWORK}`;
const NETWORK_LABEL = _CLAIM_NETWORK === "mainnet-beta" ? "Mainnet Beta" : "Devnet";

export default function Claim() {
  const { authenticated, user, login } = usePrivy();
  const publicKey = user?.wallet?.address ? new PublicKey(user.wallet.address) : null;

  const [status, setStatus] = useState<"idle" | "claiming" | "success" | "error" | "expired" | "invalid">("idle");
  const [txSig, setTxSig] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [, setLocation] = useLocation();

  const withdrawMutation = useRelayWithdraw();

  const parsed = parseClaimHash(window.location.hash);
  const secretHex = parsed?.secret ?? null;

  useEffect(() => {
    if (!secretHex) setStatus("invalid");
  }, [secretHex]);

  function clearHash() {
    try { history.replaceState(null, "", window.location.pathname); } catch { /* ok */ }
  }

  async function handleClaim() {
    if (!publicKey || !secretHex) return;
    setStatus("claiming");
    setErrorMessage("");

    withdrawMutation.mutate(
      { data: { secret: secretHex, recipient: publicKey.toBase58() } },
      {
        onSuccess: (data) => {
          setTxSig(data.signature);
          setStatus("success");
          clearHash();
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : "Claim failed";
          if (msg.toLowerCase().includes("expired")) {
            setStatus("expired");
          } else {
            setStatus("error");
            setErrorMessage(msg);
          }
        },
      }
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 selection:bg-white/15">
      <GrainOverlay />

      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.02] blur-[130px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="flex justify-center mb-8">
          <Link href="/">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1.5 cursor-pointer"
              data-testid="link-home-logo"
            >
              <div
                className="w-10 h-10 rounded-xl overflow-hidden shrink-0"
                style={{ filter: "drop-shadow(0 0 14px rgba(255,255,255,0.18))" }}
              >
                <img
                  src={`${import.meta.env.BASE_URL}logo.png`}
                  alt="D3FAULT"
                  style={{ width: "140%", height: "140%", objectFit: "cover", marginLeft: "-20%", marginTop: "-20%" }}
                />
              </div>
              <span className="text-white font-semibold text-[15px] tracking-tight">D3FAULT</span>
            </motion.div>
          </Link>
        </div>

        <div className="glass-panel-strong rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-center gap-2.5">
            <Lock className="w-3.5 h-3.5 text-white/30" />
            <span className="text-sm font-medium text-white/50">Secure Claim</span>
          </div>

          <div className="p-6">

            {status === "invalid" && (
              <div className="text-center space-y-5 py-4">
                <AlertTriangle className="w-10 h-10 text-white/25 mx-auto" />
                <div>
                  <h3 className="font-semibold text-white/70 mb-2">Invalid Link</h3>
                  <p className="text-sm text-white/35 leading-relaxed max-w-xs mx-auto font-light">
                    This link is missing the secret payload. Make sure you opened the full URL — the secret is in the fragment after the #.
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setLocation("/")}
                  className="w-full mt-2 glass-panel rounded-xl py-3 text-sm font-medium text-white/40 hover:text-white transition-colors"
                  data-testid="button-return-home"
                >
                  Back to Home
                </motion.button>
              </div>
            )}

            {status === "idle" && secretHex && (
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="w-14 h-14 glass-panel rounded-2xl flex items-center justify-center border-white/15">
                    <Shield className="w-7 h-7 text-white/45" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-semibold text-white/85 mb-1">Funds are waiting</h3>
                    <p className="text-sm text-white/35 font-light">
                      {authenticated ? "Ready to claim." : "Connect a wallet to claim your transfer."}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                  <InfoRow label="Commitment"><CommitmentDisplay secretHex={secretHex} /></InfoRow>
                  <InfoRow label="Network" last><span className="text-white/55 font-medium text-sm">{NETWORK_LABEL}</span></InfoRow>
                </div>

                {!authenticated ? (
                  <div className="space-y-3">
                    <Button
                      className="w-full h-12 rounded-xl text-sm font-semibold bg-white text-black hover:bg-white/90"
                      onClick={() => void login()}
                      data-testid="button-connect-wallet-claim"
                    >
                      Connect Wallet to Claim
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-white/[0.06] overflow-hidden">
                      <InfoRow label="Recipient" last>
                        <span className="text-white/55 font-mono text-[11px]" data-testid="text-recipient-pubkey">
                          {publicKey?.toBase58().slice(0, 8)}…{publicKey?.toBase58().slice(-6)}
                        </span>
                      </InfoRow>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.97, y: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      onClick={() => void handleClaim()}
                      className="w-full py-4 bg-white text-black text-sm font-semibold rounded-xl glow-button flex items-center justify-center gap-2"
                      data-testid="button-claim"
                    >
                      Claim Funds <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  </div>
                )}
              </div>
            )}

            {status === "claiming" && (
              <div className="text-center space-y-4 py-8">
                <Loader2 className="w-10 h-10 text-white/35 mx-auto animate-spin" />
                <div>
                  <h3 className="font-semibold text-white/65 mb-1.5">Submitting transaction…</h3>
                  <p className="text-sm text-white/25 font-light">The relayer is processing your withdrawal.</p>
                </div>
              </div>
            )}

            {status === "success" && (
              <div className="text-center space-y-5 py-4">
                <div className="w-14 h-14 mx-auto glass-panel rounded-2xl flex items-center justify-center border-white/15">
                  <CheckCircle2 className="w-7 h-7 text-white/60" />
                </div>
                <div>
                  <h3 className="font-semibold text-white/85 mb-1.5">Claimed successfully</h3>
                  <p className="text-sm text-white/35 font-light">Funds transferred to your wallet.</p>
                </div>
                {txSig && (
                  <a
                    href={`https://solscan.io/tx/${txSig}${CLAIM_EXPLORER_CLUSTER}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-white/40 hover:text-white/70 block transition-colors"
                    data-testid="link-tx-explorer"
                  >
                    View on Explorer →
                  </a>
                )}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setLocation("/app")}
                  className="w-full py-3 glass-panel rounded-xl text-sm font-medium text-white/40 hover:text-white transition-colors"
                  data-testid="button-open-terminal"
                >
                  Open Terminal
                </motion.button>
              </div>
            )}

            {status === "expired" && (
              <div className="text-center space-y-5 py-4">
                <AlertTriangle className="w-10 h-10 text-white/25 mx-auto" />
                <div>
                  <h3 className="font-semibold text-white/55 mb-1.5">Link expired</h3>
                  <p className="text-sm text-white/30 font-light leading-relaxed">
                    This claim link has expired. The sender can reclaim the funds from the D3FAULT terminal.
                  </p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setLocation("/")}
                  className="w-full py-3 glass-panel rounded-xl text-sm font-medium text-white/40 hover:text-white transition-colors"
                  data-testid="button-return-home"
                >
                  Back to Home
                </motion.button>
              </div>
            )}

            {status === "error" && (
              <div className="text-center space-y-5 py-4">
                <AlertTriangle className="w-10 h-10 text-white/25 mx-auto" />
                <div>
                  <h3 className="font-semibold text-white/55 mb-1.5">Claim failed</h3>
                  {errorMessage && (
                    <p className="text-[11px] text-white/25 font-mono border border-white/[0.06] rounded-lg p-3 bg-white/[0.015] text-left leading-relaxed mt-2">
                      {errorMessage}
                    </p>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { setStatus("idle"); setErrorMessage(""); }}
                  className="w-full py-3.5 bg-white text-black text-sm font-semibold rounded-xl glow-button"
                  data-testid="button-retry"
                >
                  Try Again
                </motion.button>
              </div>
            )}
          </div>

          <div className="px-5 py-3.5 border-t border-white/[0.05] text-center">
            <span className="text-[11px] text-white/20 font-medium">
              Gas covered by protocol · {NETWORK_LABEL}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function InfoRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`flex justify-between items-center px-4 py-3 bg-white/[0.025] gap-3 ${!last ? "border-b border-white/[0.05]" : ""}`}>
      <span className="text-white/30 font-medium text-sm shrink-0">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

function CommitmentDisplay({ secretHex }: { secretHex: string }) {
  const [commitment, setCommitment] = useState<string>("…");

  useEffect(() => {
    const secret = new Uint8Array(secretHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    void computeCommitment(secret).then((c) => {
      setCommitment(toHex(c).slice(0, 12) + "…");
    });
  }, [secretHex]);

  return <span className="text-white/55 font-mono text-[11px]">{commitment}</span>;
}
