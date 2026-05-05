#!/bin/bash
# D3FAULT — Mac Rebuild + Program Upgrade Script
#
# Run this on your Mac after downloading d3fault-src.tar.gz from Replit.
#
# What this does:
#   1. Extracts updated lib.rs (zero_copy fix for stack overflow)
#   2. Rebuilds the program binary
#   3. Upgrades the mainnet program
#   4. Runs the CommitmentStore initializer
#
# Prerequisites on Mac:
#   - Solana CLI:  solana --version  (>= 1.16)
#   - Anchor CLI:  anchor --version  (0.29.x)
#   - Node.js:     node --version    (>= 18)
#   - pnpm:        pnpm --version

set -e

PROGRAM_ID="2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG"
RPC="${SOLANA_RPC_ENDPOINT:-https://api.mainnet-beta.solana.com}"
# Set SOLANA_RPC_ENDPOINT in your environment to use a private RPC (e.g. Helius, Alchemy).
# Example: export SOLANA_RPC_ENDPOINT="https://mainnet.helius-rpc.com/?api-key=<your-key>"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║     D3FAULT — Rebuild + Upgrade (zero_copy fix)      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Program ID : $PROGRAM_ID"
echo "  RPC        : Helius mainnet"
echo ""

# ── Step 1: Verify prereqs ────────────────────────────────────────────────────

echo "=== Step 1: Verifying tools ==="

if ! command -v solana &>/dev/null; then
  echo "ERROR: solana CLI not found. Install from https://docs.solana.com/cli/install-solana-cli-tools"
  exit 1
fi
echo "  solana: $(solana --version)"

if ! command -v anchor &>/dev/null; then
  echo "ERROR: anchor CLI not found. Run: cargo install --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.29.0"
  exit 1
fi
echo "  anchor: $(anchor --version)"

if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm not found. Run: npm install -g pnpm"
  exit 1
fi

# ── Step 2: Locate workspace ──────────────────────────────────────────────────

echo ""
echo "=== Step 2: Locating workspace ==="

# If run from project root, use it; otherwise try parent
if [ -f "program/Anchor.toml" ]; then
  WORKSPACE="$SCRIPT_DIR"
elif [ -f "../program/Anchor.toml" ]; then
  WORKSPACE="$(cd .. && pwd)"
else
  echo "ERROR: Cannot find program/Anchor.toml — run this script from the project root."
  exit 1
fi

echo "  Workspace: $WORKSPACE"
cd "$WORKSPACE"

DEPLOYER_KEYPAIR="$WORKSPACE/deployer-keypair.json"
PROGRAM_KEYPAIR="$WORKSPACE/program/target/deploy/private_transfer-keypair.json"
PROGRAM_SO="$WORKSPACE/program/target/deploy/private_transfer.so"

if [ ! -f "$DEPLOYER_KEYPAIR" ]; then
  echo "ERROR: deployer-keypair.json not found at $WORKSPACE"
  exit 1
fi

# ── Step 3: Set RPC and verify balance ────────────────────────────────────────

echo ""
echo "=== Step 3: Checking deployer balance ==="

solana config set --url "$RPC" --keypair "$DEPLOYER_KEYPAIR" -q
DEPLOYER_ADDR=$(solana address)
BALANCE=$(solana balance 2>/dev/null || echo "0 SOL")
echo "  Address : $DEPLOYER_ADDR"
echo "  Balance : $BALANCE"

# ── Step 4: Build ─────────────────────────────────────────────────────────────

echo ""
echo "=== Step 4: Building program (zero_copy layout) ==="

cd "$WORKSPACE/program"
anchor build 2>&1 | tail -5

if [ ! -f "$PROGRAM_SO" ]; then
  echo "ERROR: Build failed — $PROGRAM_SO not found"
  exit 1
fi

SO_SIZE=$(du -h "$PROGRAM_SO" | cut -f1)
echo "  Binary: $SO_SIZE at $PROGRAM_SO"

# ── Step 5: Upgrade mainnet program ───────────────────────────────────────────

echo ""
echo "=== Step 5: Upgrading mainnet program ==="
echo ""
echo "  Uploading $SO_SIZE to mainnet-beta..."
echo "  (Buffer rent ~2.0 SOL will be returned after upgrade)"
echo ""

cd "$WORKSPACE"
solana program deploy \
  --url "$RPC" \
  --program-id "$PROGRAM_KEYPAIR" \
  --commitment confirmed \
  --with-compute-unit-price 50000 \
  "$PROGRAM_SO"

echo ""
echo "  Explorer: https://explorer.solana.com/address/$PROGRAM_ID"

# ── Step 6: Initialize CommitmentStore ────────────────────────────────────────

echo ""
echo "=== Step 6: Initializing CommitmentStore (30,744 bytes) ==="
echo ""

# Try tsx if available, else node
TSX_CMD=""
if command -v npx &>/dev/null; then
  TSX_CMD="npx tsx"
elif command -v pnpm &>/dev/null; then
  TSX_CMD="pnpm exec tsx"
fi

if [ -z "$TSX_CMD" ]; then
  echo "  WARNING: tsx not found. Run manually:"
  echo "    npx tsx artifacts/api-server/init-store-raw.ts \\"
  echo "      --keypair $DEPLOYER_KEYPAIR \\"
  echo "      --rpc \"$RPC\""
else
  # Check for init-store-raw.ts
  INIT_SCRIPT=""
  if [ -f "$WORKSPACE/artifacts/api-server/init-store-raw.ts" ]; then
    INIT_SCRIPT="$WORKSPACE/artifacts/api-server/init-store-raw.ts"
  elif [ -f "$WORKSPACE/program/scripts/init-store.ts" ]; then
    INIT_SCRIPT="$WORKSPACE/program/scripts/init-store.ts"
  fi

  if [ -n "$INIT_SCRIPT" ]; then
    cd "$WORKSPACE"
    $TSX_CMD "$INIT_SCRIPT" \
      --keypair "$DEPLOYER_KEYPAIR" \
      --rpc "$RPC"
  else
    echo "  WARNING: init script not found. PDA not yet initialized."
  fi
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Upgrade complete! Update Replit env vars:           ║"
echo "║    PROGRAM_ID=2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG  ║"
echo "║    SOLANA_NETWORK=mainnet-beta                       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
