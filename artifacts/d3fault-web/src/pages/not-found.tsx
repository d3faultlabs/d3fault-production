import { Link } from "wouter";
import { motion } from "framer-motion";
import { GrainOverlay } from "@/components/GrainOverlay";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center px-6 selection:bg-white/15">
      <GrainOverlay />

      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/[0.018] blur-[140px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        className="relative z-10 text-center max-w-sm"
      >
        <div className="text-[120px] font-bold text-white/[0.06] leading-none select-none mb-6">
          404
        </div>
        <h1 className="text-2xl font-semibold text-white mb-3 tracking-tight">
          Page not found
        </h1>
        <p className="text-[15px] text-white/35 font-light mb-10 leading-relaxed">
          The page you're looking for doesn't exist or was moved.
        </p>
        <Link href="/">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            className="glass-panel rounded-xl px-7 py-3 text-sm font-semibold text-white hover:bg-white/[0.08] transition-colors"
          >
            ← Back to Home
          </motion.button>
        </Link>
      </motion.div>
    </div>
  );
}
