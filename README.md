# D3FAULT — Non-Custodial Privacy Protocol on Solana

> Deposit SOL or SPL tokens behind a SHA-256 cryptographic commitment. Share a claim link. The recipient withdraws to any wallet with zero on-chain link to the sender.

## Status

| Component | Status | Details |
|-----------|--------|---------|
| On-chain program | Live on Mainnet | `2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG` |
| API server | Running | Express 5, Node.js 20, PostgreSQL |
| Frontend | Live | React 19 + Vite at https://d3fault.sh |
| Status page | Live | https://d3fault.sh/status |

---

## How it works

```
Wallet A  →  deposit(SHA-256(secret))  →  Solana Program
                                                 |
Wallet B  ←  withdraw(secret)          ←  Relayer (pays gas)
```

Two structurally unlinked on-chain transactions. No bridge. No wrapped tokens. No KYC.

---

## Architecture

```
artifacts/
  api-server/     Express 5 API — auth, relay, program queries
  d3fault-web/    React 19 + Vite — main frontend
  status-web/     Status monitoring page
lib/
  d3fault-shared/ Commitment helpers, IDL
  api-spec/       OpenAPI spec (source of truth for REST contract)
  api-zod/        Zod schemas generated from OpenAPI
  db/             Drizzle ORM + PostgreSQL schema
```

---

## On-chain program

- **Program ID:** `2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG`
- **Network:** Solana mainnet-beta
- **Framework:** Anchor 0.29.0
- **Language:** Rust
- **Source:** [d3faultlabs/d3fault-program](https://github.com/d3faultlabs/d3fault-program)
- **Verification:** executable hash matches on-chain — see [VERIFICATION.md](https://github.com/d3faultlabs/d3fault-program/blob/main/VERIFICATION.md)

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 20 |
| API framework | Express 5 |
| Frontend | React 19, Vite, TailwindCSS v4 |
| Auth | Privy (wallet + social login) |
| Database | PostgreSQL, Drizzle ORM |
| Validation | Zod |
| Logging | Pino |
| On-chain | Solana web3.js, Anchor 0.29.0 |

---

## Security

See [SECURITY.md](SECURITY.md) for the full security policy, responsible disclosure process, and incident response playbook.

---

## Links

- App: https://d3fault.sh
- Status: https://d3fault.sh/status
- Developer API: https://d3fault.sh/developer
- On-chain program: https://solscan.io/account/2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG
