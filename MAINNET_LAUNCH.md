# D3FAULT — Mainnet Launch Checklist

## Overview

D3FAULT is a privacy-focused Solana DEX using a commitment-nullifier scheme to break
the on-chain link between depositor and recipient. Funds are held in a PDA-owned escrow.
The relayer submits withdrawal transactions on behalf of recipients so the recipient
address never appears in the deposit transaction.

---

## Pre-Launch Checklist

### 1. Smart Contract (Anchor)

- [ ] Audit complete (minimum one independent security audit)
- [ ] Fuzzing / property-based tests passing (`cargo test-sbf`)
- [ ] `declare_id!` updated to real mainnet program ID after `anchor build && anchor deploy`
- [ ] IDL exported and committed to `artifacts/api-server/src/idl/private_transfer.json`
- [ ] IDL address field in JSON matches real deployed program ID
- [ ] Program verified on-chain via `anchor verify`
- [ ] Upgrade authority multi-sig configured (or program frozen if immutable)

### 2. Relayer Service

- [ ] `PROGRAM_ID` env var set to real mainnet program ID
- [ ] `SOLANA_NETWORK=mainnet-beta`
- [ ] `SOLANA_RPC_ENDPOINT` set to paid RPC (Helius, QuickNode, or Triton)
- [ ] `RELAYER_PRIVATE_KEY` set in secrets manager (never committed)
- [ ] Relayer wallet funded with ≥ 1 SOL to cover tx fees + nullifier PDA rent
- [ ] Rate limiting reviewed and hardened (current: 10 req/min per IP)
- [ ] Relayer logs forwarding to production observability stack

### 3. Frontend

- [ ] `VITE_API_BASE_URL` pointed at production relayer domain
- [ ] `VITE_SOLANA_NETWORK=mainnet-beta`
- [ ] All devnet-only warnings removed from UI
- [ ] "Devnet Preview" badge updated to reflect production status
- [ ] Content Security Policy headers set for wallet adapter iframes
- [ ] Claim page gracefully handles invalid/expired/already-claimed links

### 4. Infrastructure

- [ ] HTTPS with valid TLS certificate on relayer and frontend domains
- [ ] DDoS protection (Cloudflare or equivalent) in front of relayer
- [ ] Database (if added) encrypted at rest with automated backups
- [ ] Incident response runbook documented

### 5. Security

- [ ] No private keys in environment files or source code
- [ ] Dependency audit clean (`pnpm audit --prod`)
- [ ] CORS policy on relayer restricted to production frontend domain
- [ ] Commitment store capacity (1024 entries) monitored — add pagination if needed
- [ ] Expiry times enforced on-chain and validated in UI

---

## Deployment Steps

### Deploy Anchor Program

```bash
# Install Solana CLI + Anchor CLI
# Configure wallet with mainnet SOL for deployment fees

anchor build
anchor deploy --provider.cluster mainnet-beta --provider.wallet <YOUR_DEPLOY_KEYPAIR>

# Copy the program ID from output, update:
# - program/programs/private_transfer/src/lib.rs declare_id!(...)
# - PROGRAM_ID env var on relayer
# - artifacts/api-server/src/idl/private_transfer.json "address" field

# Initialize the commitment store (one-time, owner only)
anchor run initialize --provider.cluster mainnet-beta
```

### Environment Variables

| Variable | Description | Example |
|---|---|---|
| `PROGRAM_ID` | Deployed program address | `D3FAu...` |
| `SOLANA_NETWORK` | Network name | `mainnet-beta` |
| `SOLANA_RPC_ENDPOINT` | RPC URL | `https://rpc.helius.xyz/?api-key=...` |
| `RELAYER_PRIVATE_KEY` | JSON byte array of relayer keypair | `[1,2,3,...]` |

---

## Devnet Verification (Current State)

The program is currently on **devnet** with a placeholder ID. To test on devnet:

1. Get devnet SOL: `solana airdrop 2 --url devnet`
2. Deploy: `anchor deploy --provider.cluster devnet`
3. Initialize store: `anchor run initialize --provider.cluster devnet`
4. Set `PROGRAM_ID` to devnet address, restart relayer
5. Test full flow: deposit → generate link → open `/claim#<secret>` → claim

---

## Commitment-Nullifier Protocol

```
Client (browser):
  secret = random 32 bytes
  commitment = sha256(secret)
  link = /claim#<secret_hex>

On deposit tx:
  send commitment + amount to program
  program stores: { commitment, amount, expiry, token_mint, depositor }

On claim:
  recipient opens link, wallet signs
  relayer receives: { secret, recipient }
  relayer computes: commitment = sha256(secret)
  program verifies: sha256(secret) == stored commitment
  program creates: nullifier PDA seeded by commitment (prevents replay)
  program transfers: funds from escrow to recipient
```

The link holder proves knowledge of the preimage (secret) of the stored commitment.
The nullifier PDA ensures the same secret cannot be used twice.
