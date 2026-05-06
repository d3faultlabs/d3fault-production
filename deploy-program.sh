#!/bin/bash
# D3FAULT Anchor Program Deployment Script
# Run this once you have funded the deployer wallet with devnet SOL
#
# ⚠️ SECURITY NOTES:
#   - Do NOT commit keypair.json files to git
#   - Keep deployer-keypair.json in a secure location only
#   - Never expose your wallet keypair or private keys
#   - Use environment variables for sensitive RPC endpoints with API keys

set -e

SOLANA_BIN="$HOME/.local/share/solana/install/active_release/bin"
export PATH="$HOME/bin:$SOLANA_BIN:$PATH"

DEPLOYER_ADDR="CmUy3w7BHnr9oyqXxWxVfPQUvpqjkPbwPZ9ycRijeD8V"
PROGRAM_ID="2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG"
PROGRAM_SO="program/target/deploy/private_transfer.so"
PROGRAM_KEYPAIR="program/target/deploy/private_transfer-keypair.json"

echo "=== D3FAULT Program Deployment ==="
echo "Deployer:   $DEPLOYER_ADDR"
echo "Program ID: $PROGRAM_ID"
echo ""

# Check balance
BALANCE=$($SOLANA_BIN/solana balance --url devnet 2>&1)
echo "Current balance: $BALANCE"

if [ ! -f "$PROGRAM_SO" ]; then
  echo "ERROR: Program binary not found at $PROGRAM_SO"
  echo "Run the build first: export PATH=\$HOME/bin:\$HOME/.local/share/solana/install/active_release/bin:\$PATH && cd program && cargo-build-sbf --manifest-path programs/private_transfer/Cargo.toml --tools-version v1.48"
  exit 1
fi

echo ""
echo "Deploying program..."
$SOLANA_BIN/solana program deploy \
  --url devnet \
  --program-id "$PROGRAM_KEYPAIR" \
  "$PROGRAM_SO"

echo ""
echo "=== Deployment Complete ==="
echo "Program ID: $PROGRAM_ID"
echo "Verify at: https://explorer.solana.com/address/$PROGRAM_ID?cluster=devnet"
