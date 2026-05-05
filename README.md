# D3FAULT — Privacy-First Solana Protocol

> Deposit SOL or SPL tokens behind a cryptographic commitment. Share a claim link. The recipient withdraws without any on-chain link to your address.

D3FAULT is a privacy-transfer protocol built on Solana. It uses a commitment–nullifier scheme: a depositor commits `SHA-256(secret)` on-chain; a recipient reveals the secret to withdraw — the relayer pays the gas, so the recipient never needs SOL to claim.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser (artifacts/d3fault-web)                                │
│  React + Vite + TailwindCSS + Privy wallet auth                 │
│    /           → Marketing homepage                             │
│    /app        → DEX terminal (Send · Receive · Developers)     │
│    /claim      → Claim-link redemption                          │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST (Bearer API key or Privy JWT)
┌────────────────────────▼────────────────────────────────────────┐
│  API Server (artifacts/api-server)                              │
│  Express 5 + TypeScript + Drizzle ORM (PostgreSQL)             │
│    /api/healthz                 — liveness probe                │
│    /api/v1/program              — on-chain program metadata     │
│    /api/v1/store/commitments    — list commitment ring-buffer   │
│    /api/v1/tx/deposit-sol/build — build unsigned deposit tx     │
│    /api/v1/tx/deposit-spl/build — build unsigned SPL deposit tx │
│    /api/v1/tx/withdraw          — relayer-signed withdrawal     │
│    /api/v1/auth/keys            — API key management (Privy)    │
└────────────────────────┬────────────────────────────────────────┘
                         │ RPC calls
┌────────────────────────▼────────────────────────────────────────┐
│  Solana (mainnet-beta)                                          │
│  Anchor program: private_transfer                               │
│  Program ID: 2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG     │
│  CommitmentStore PDA (ring buffer, 64 slots)                    │
└─────────────────────────────────────────────────────────────────┘
```

### Shared packages (`lib/`)

| Package | Purpose |
|---|---|
| `lib/d3fault-shared` | Protocol constants, IDL, commitment helpers (generateSecret, computeCommitment, buildClaimUrl) |
| `lib/db` | Drizzle ORM schema + client (PostgreSQL) |
| `lib/api-spec` | OpenAPI YAML — single source of truth for the REST contract |
| `lib/api-client-react` | Auto-generated React Query hooks (Orval) |
| `lib/api-zod` | Auto-generated Zod schemas (Orval) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Monorepo | pnpm workspaces |
| Language | TypeScript 5.9, Node.js 24 |
| Frontend | React 19, Vite, TailwindCSS v4, Framer Motion |
| Wallet auth | Privy (`@privy-io/react-auth`) |
| Solana client | `@solana/web3.js`, `@coral-xyz/anchor` |
| API server | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4, drizzle-zod |
| On-chain | Anchor 0.31.1, Rust (Solana BPF) |
| Build | esbuild (API), Vite (frontend) |

---

## Prerequisites

- **Node.js** ≥ 24
- **pnpm** ≥ 9 — `npm i -g pnpm`
- **PostgreSQL** — local or hosted (e.g. Supabase, Neon)
- **Solana CLI** — [install guide](https://docs.solana.com/cli/install-solana-cli-tools)
- **Anchor CLI** ≥ 0.31.1 — `cargo install --git https://github.com/coral-xyz/anchor anchor-cli`
- A **Privy** account ([privy.io](https://privy.io)) for wallet auth
- A Solana RPC endpoint (e.g. [Helius](https://helius.dev), [Alchemy](https://www.alchemy.com/solana))

---

## Local Setup

### 1. Clone and install

```bash
git clone https://github.com/your-org/d3fault.git
cd d3fault
pnpm install
```

### 2. Configure environment variables

Copy the example env files and fill in your values:

```bash
cp artifacts/api-server/.env.example artifacts/api-server/.env
cp artifacts/d3fault-web/.env.example artifacts/d3fault-web/.env
```

See the **Environment Variables** section below for a description of every variable.

### 3. Set up the database

```bash
# Apply the schema to your PostgreSQL database
pnpm --filter @workspace/db drizzle-kit push
```

### 4. Run the services

In separate terminals:

```bash
# API server
pnpm --filter @workspace/api-server dev

# Frontend (Vite dev server)
pnpm --filter @workspace/d3fault-web dev
```

The frontend runs on `http://localhost:<PORT>` and the API on its own port (both read `PORT` from the environment).

---

## Environment Variables

### API Server (`artifacts/api-server/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | TCP port the Express server listens on |
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgres://user:pass@host/db`) |
| `SOLANA_NETWORK` | Yes | `mainnet-beta`, `devnet`, or `localnet` |
| `SOLANA_RPC_ENDPOINT` | Yes | Primary Solana RPC URL (include API key in the URL) |
| `PROGRAM_ID` | Yes | Deployed Anchor program ID |
| `RELAYER_PRIVATE_KEY` | Yes | Base58 private key of the relayer wallet (pays withdrawal gas) |
| `PRIVY_APP_ID` | Yes | Privy application ID (also accepted as `VITE_PRIVY_APP_ID`) |
| `PRIVY_APP_SECRET` | Yes | Privy application secret (server-side only — never expose to the browser) |
| `NODE_ENV` | No | `development` or `production` (default: `development`) |
| `LOG_LEVEL` | No | Pino log level: `trace`, `debug`, `info`, `warn`, `error` (default: `info`) |

### Frontend (`artifacts/d3fault-web/.env`)

| Variable | Required | Description |
|---|---|---|
| `PORT` | Yes | TCP port the Vite dev server listens on |
| `BASE_PATH` | Yes | URL base path prefix (e.g. `/` for root, `/app` for sub-path) |
| `VITE_SOLANA_NETWORK` | Yes | `mainnet-beta` or `devnet` — shown in the UI |
| `VITE_PRIVY_APP_ID` | Yes | Privy application ID (public — safe to embed in the browser bundle) |
| `VITE_SOLANA_RPC_ENDPOINT` | No | Override the primary RPC endpoint used by the browser client |
| `VITE_SOLANA_RPC_ENDPOINT_2` | No | Optional secondary RPC used as the first fallback (Helius, etc.) |

---

## Running the Anchor Program

### Build

```bash
cd program
anchor build
```

### Test (localnet)

```bash
cd program
anchor test
```

### Deploy to devnet

```bash
# Fund your deployer wallet first
solana airdrop 5 --url devnet

# Then run the deploy script
bash deploy-program.sh
```

The script expects `program/target/deploy/private_transfer.so` and `program/target/deploy/private_transfer-keypair.json` to exist (produced by `anchor build`).

### Deploy to mainnet-beta

Edit `deploy-mainnet.sh` with your mainnet RPC and deployer wallet, then:

```bash
bash deploy-mainnet.sh
```

> The program is already deployed at `2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG` on mainnet-beta. You only need to redeploy if you change the on-chain code.

---

## Building for Production

```bash
# Build all packages
pnpm -r run build

# Or individually:
pnpm --filter @workspace/api-server build
pnpm --filter @workspace/d3fault-web build
```

The API server build output is at `artifacts/api-server/dist/index.js` (CJS bundle via esbuild).
The frontend build output is at `artifacts/d3fault-web/dist/public/`.

---

## Running Tests

```bash
# All tests
pnpm -r run test

# API server only (Vitest + Supertest)
pnpm --filter @workspace/api-server test
```

---

## Documentation

- **[API Reference](docs/api.md)** — Full REST API documentation with request/response shapes, error codes, rate limits, and code examples (cURL, TypeScript, Python).
- **[Status Page Spec](docs/status.md)** — Specification for the public status page (`status.d3fault.app`) covering components, incident lifecycle, and SLO targets.

---

## Before Your First GitHub Push

If the repository has any previously-tracked build output (e.g. `program/target/`) or generated files that the `.gitignore` now covers, you must untrack them before pushing so they are not included in the public repo:

```bash
# Remove tracked build output from git's index (keeps the files on disk)
git rm -r --cached program/target/
git rm -r --cached '**/dist/' 2>/dev/null || true
git rm -r --cached '**/*.tsbuildinfo' 2>/dev/null || true

# Commit the cleanup
git add .gitignore
git commit -m "chore: untrack build artifacts and add comprehensive .gitignore"
```

This only removes them from git tracking — it does not delete the files locally.

---

## Security Notes

- **Never commit `.env` files.** Use `.env.example` as a template with placeholder values only.
- **`RELAYER_PRIVATE_KEY`** controls the relayer wallet that pays withdrawal fees. Store it in a secrets manager (e.g. HashiCorp Vault, AWS Secrets Manager, Doppler).
- **`PRIVY_APP_SECRET`** is a server-side secret — never include it in the frontend bundle or any client-visible config.
- Generate secrets client-side when possible. The `/api/v1/secrets/generate` endpoint is a convenience helper, but it means D3FAULT sees the secret before commitment.
- API keys are stored as SHA-256 hashes. The plaintext key is shown **once** at creation — store it immediately.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

# d3fault-production
