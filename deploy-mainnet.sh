#!/bin/bash
# D3FAULT — Mainnet Deployment Script
#
# Deploys the private_transfer program to Solana mainnet-beta.
#
# Prerequisites:
#   1. Solana CLI installed (https://docs.solana.com/cli/install-solana-cli-tools)
#   2. Anchor CLI installed (cargo install --git https://github.com/coral-xyz/anchor anchor-cli --tag v0.29.0)
#   3. Program binary compiled (see STEP 1 below)
#   4. Deployer wallet funded with ~1.5 SOL
#
# Run from the project root: bash deploy-mainnet.sh

set -e

# ── Paths ────────────────────────────────────────────────────────────────────

SOLANA_BIN="$HOME/.local/share/solana/install/active_release/bin"
export PATH="$HOME/bin:$SOLANA_BIN:$PATH"

PROGRAM_ID="2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG"
PROGRAM_SO="program/target/deploy/private_transfer.so"
PROGRAM_KEYPAIR="program/target/deploy/private_transfer-keypair.json"
RPC="${SOLANA_MAINNET_RPC:-https://api.mainnet-beta.solana.com}"

# ── Header ───────────────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         D3FAULT — Mainnet Deployment                 ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Program ID : $PROGRAM_ID"
echo "  RPC        : $RPC"
echo "  Binary     : $PROGRAM_SO"
echo ""

# ── STEP 1: Build the program ─────────────────────────────────────────────────
#
# The Cargo vendor directory is no longer present, so we must use the online
# crates.io registry. Temporarily rename the vendor config if it exists.

echo "=== STEP 1: Build ==="

if [ -f "$PROGRAM_SO" ]; then
  echo "  Pre-built binary found — skipping build step."
else
  CARGO_CONFIG="program/.cargo/config.toml"
  CARGO_CONFIG_BAK="program/.cargo/config.toml.disabled"

  if [ -f "$CARGO_CONFIG" ] && grep -q "vendored-sources" "$CARGO_CONFIG" 2>/dev/null; then
    echo "  Disabling vendor config (crates.io will be used)..."
    mv "$CARGO_CONFIG" "$CARGO_CONFIG_BAK"
    RESTORE_VENDOR_CONFIG=1
  fi

  restore_vendor_config() {
    if [ "${RESTORE_VENDOR_CONFIG:-0}" = "1" ] && [ -f "$CARGO_CONFIG_BAK" ]; then
      mv "$CARGO_CONFIG_BAK" "$CARGO_CONFIG"
    fi
  }
  trap restore_vendor_config EXIT

  echo "  Building with release profile..."
  if command -v cargo-build-sbf &>/dev/null; then
    cargo-build-sbf --manifest-path program/programs/private_transfer/Cargo.toml
  elif command -v anchor &>/dev/null; then
    (cd program && anchor build)
  else
    echo "ERROR: Neither cargo-build-sbf nor anchor CLI found."
    echo "Install Solana platform tools: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
  fi

  restore_vendor_config
  RESTORE_VENDOR_CONFIG=0

  if [ ! -f "$PROGRAM_SO" ]; then
    echo "ERROR: Build succeeded but binary not found at $PROGRAM_SO"
    exit 1
  fi
fi

SO_SIZE=$(du -h "$PROGRAM_SO" | cut -f1)
SO_MTIME=$(date -r "$PROGRAM_SO" "+%Y-%m-%d %H:%M")
echo "  Binary: $SO_SIZE  (built $SO_MTIME)"

# ── STEP 2: Verify keypair & balance ─────────────────────────────────────────

echo ""
echo "=== STEP 2: Verify wallet ==="

if [ ! -f "$PROGRAM_KEYPAIR" ]; then
  echo "ERROR: Program keypair not found at $PROGRAM_KEYPAIR"
  echo "CRITICAL: Keep this file safe — it controls program upgrade authority."
  exit 1
fi

DEPLOYER_ADDR=$("$SOLANA_BIN/solana" address 2>/dev/null || solana address)
echo "  Deployer : $DEPLOYER_ADDR"

BALANCE_RAW=$("$SOLANA_BIN/solana" balance --url "$RPC" 2>/dev/null || solana balance --url "$RPC")
echo "  Balance  : $BALANCE_RAW"

# ── STEP 3: Confirm ──────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ⚠  This will deploy to MAINNET using real SOL.  ⚠  ║"
echo "║  Wallet needed:  ~5.5 SOL (incl. temp buffer)       ║"
echo "║  Net permanent:  ~2.8 SOL (program + store rent)    ║"
echo "║  Buffer returns: ~2.6 SOL after deploy completes    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
read -rp "  Type YES to continue: " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
  echo "Aborted."
  exit 0
fi

# ── STEP 4: Deploy ───────────────────────────────────────────────────────────

echo ""
echo "=== STEP 4: Deploy program ==="
echo "  Uploading $SO_SIZE binary to mainnet-beta..."

"$SOLANA_BIN/solana" program deploy \
  --url "$RPC" \
  --program-id "$PROGRAM_KEYPAIR" \
  --commitment confirmed \
  "$PROGRAM_SO"

echo ""
echo "  Explorer: https://explorer.solana.com/address/$PROGRAM_ID"

# ── STEP 5: Initialize CommitmentStore ───────────────────────────────────────

echo ""
echo "=== STEP 5: Initialize CommitmentStore PDA ==="
echo ""
echo "  Run the initializer next:"
echo ""
echo "    npx tsx program/scripts/init-store.ts \\"
echo "      --program $PROGRAM_ID \\"
echo "      --rpc $RPC"
echo ""
echo "  This creates the 30,744-byte CommitmentStore account (~0.21 SOL rent)."
echo "  It only needs to be called once."

# ── STEP 6: Environment variables ────────────────────────────────────────────

echo ""
echo "=== STEP 6: Set environment variables ==="
echo ""
echo "  Update these secrets in your deployment environment:"
echo ""
echo "    PROGRAM_ID=$PROGRAM_ID"
echo "    SOLANA_NETWORK=mainnet-beta"
echo "    SOLANA_RPC_ENDPOINT=$RPC"
echo "    VITE_SOLANA_NETWORK=mainnet-beta"
echo ""
echo "=== Deployment complete! ==="
