import React from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

import Home from "@/pages/home";
import AppDex from "@/pages/app";
import Claim from "@/pages/claim";
import NotFound from "@/pages/not-found";
import { DocsPage, ProtocolPage, SecurityPage } from "@/pages/info";

const queryClient = new QueryClient();
const solanaConnectors = toSolanaWalletConnectors({ shouldAutoConnect: false });

if (typeof document !== "undefined") {
  document.documentElement.classList.add("dark");
}

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const pageTransition = {
  duration: 0.35,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

function AnimatedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      <Component />
    </motion.div>
  );
}

function Router() {
  const [location] = useLocation();
  const routeKey =
    location === "/" ? "home" :
    location.startsWith("/app") ? "app" :
    location.startsWith("/claim") ? "claim" :
    location.startsWith("/docs") ? "docs" :
    location.startsWith("/protocol") ? "protocol" :
    location.startsWith("/security") ? "security" :
    location;
  return (
    <AnimatePresence mode="wait">
      <Switch key={routeKey} location={location}>
        <Route path="/" component={() => <AnimatedRoute component={Home} />} />
        <Route path="/app/:section?" component={() => <AnimatedRoute component={AppDex} />} />
        <Route path="/claim" component={() => <AnimatedRoute component={Claim} />} />
        <Route path="/docs" component={() => <AnimatedRoute component={DocsPage} />} />
        <Route path="/protocol" component={() => <AnimatedRoute component={ProtocolPage} />} />
        <Route path="/security" component={() => <AnimatedRoute component={SecurityPage} />} />
        <Route component={NotFound} />
      </Switch>
    </AnimatePresence>
  );
}

function App() {
  if (!PRIVY_APP_ID) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Switch>
              <Route path="/" component={Home} />
              <Route>
                {() => (
                  <div className="min-h-screen bg-black text-white flex items-center justify-center font-mono text-center p-8">
                    <div>
                      <div className="text-yellow-400 text-lg mb-2">VITE_PRIVY_APP_ID not configured</div>
                      <div className="text-sm text-gray-400">
                        The DEX terminal requires a Privy App ID to be set.
                      </div>
                    </div>
                  </div>
                )}
              </Route>
            </Switch>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#00D4FF",
          walletList: ["phantom", "solflare", "backpack", "jupiter"],
          walletChainType: "solana-only",
        },
        externalWallets: {
          solana: { connectors: solanaConnectors },
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}

export default App;
