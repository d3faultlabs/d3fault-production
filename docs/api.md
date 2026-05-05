# D3FAULT Public API

The D3FAULT Public API lets you build, broadcast, and monitor private-transfer
commitments on Solana from any backend. All public endpoints live under the
`/api/v1/*` prefix and are authenticated with a Bearer API key.

- **Base URL (prod):** `https://api.d3fault.app`
- **Base URL (dev):** the `$REPLIT_DEV_DOMAIN` of the running API artifact
- **Content type:** `application/json` for all request and response bodies
- **API version:** `v1` (URL-versioned — breaking changes ship under a new prefix)

---

## Authentication

Every `/api/v1/*` request (other than the key-management routes under
`/api/v1/auth/*`, which use your dashboard session) must carry a Bearer API key:

```http
Authorization: Bearer dfk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

Keys are minted from the **Developers** page of the D3FAULT dashboard. Each key
is shown **once** at creation time — store it in your secret manager
immediately. We only persist a SHA-256 hash plus a short prefix
(e.g. `dfk_live_abcd`) for display.

| State    | Behavior                                                          |
| -------- | ----------------------------------------------------------------- |
| Active   | Requests succeed, `last_used_at` and `usage_count` are updated.   |
| Revoked  | All requests return `403 KEY_REVOKED`. Revocation is irreversible. |
| Missing  | `401 UNAUTHORIZED` (no header) or `401 INVALID_KEY` (bad format). |

### Key management endpoints (dashboard session)

These four endpoints sit under `/api/v1/auth/*` and authenticate via the Privy
session cookie used by the web dashboard, not via a Bearer key.

| Method   | Path                       | Purpose                                  |
| -------- | -------------------------- | ---------------------------------------- |
| `POST`   | `/api/v1/auth/keys`        | Create a new key (returns `key` once).   |
| `GET`    | `/api/v1/auth/keys`        | List your keys (prefix only, no secret). |
| `DELETE` | `/api/v1/auth/keys/:id`    | Revoke a key (soft delete).              |
| `GET`    | `/api/v1/auth/keys/usage`  | Hourly request/error counts (last 24h). |

---

## Rate limits

Each key has its own per-minute budget (default **60 requests / minute**, set on
the `api_keys.rate_limit` column). The limiter is keyed by the API key's
internal id, so different keys do not contend with each other.

Standard `RateLimit-*` headers are returned on every successful response:

```http
RateLimit-Limit: 60
RateLimit-Remaining: 57
RateLimit-Reset: 42
```

When you exceed the budget you get:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "error": "Rate limit exceeded — try again in a minute",
  "code": "RATE_LIMITED"
}
```

Need a higher limit? Contact support — we tune `rate_limit` per key.

---

## Endpoints

### `GET /api/v1/program`

Returns the on-chain program metadata that your client needs to talk to the
deployed D3FAULT program.

**Response**

```json
{
  "programId": "D3F...",
  "network": "devnet",
  "relayerPubkey": "Re1ay...",
  "storeState": "ready"
}
```

`storeState` is one of `ready` (initialized), `stuck` (system-owned with
lamports — needs recovery), or `clean` (account does not exist yet).

---

### `GET /api/v1/store/commitments`

Lists every commitment slot in the on-chain commitment store.

**Query params**

| Name     | Type     | Default | Description                                       |
| -------- | -------- | ------- | ------------------------------------------------- |
| `status` | string   | `all`   | One of `all`, `active`, `claimed`, `expired`.     |

**Response**

```json
[
  {
    "commitment": "ab12…ef",
    "amount": "1000000",
    "expiry": 1735689600,
    "tokenMint": "11111111111111111111111111111111",
    "claimed": false,
    "depositor": "Dep0sit0r..."
  }
]
```

`tokenMint` is the SPL mint, or `11111111111111111111111111111111` for native
SOL deposits.

---

### `GET /api/v1/store/lookup/:commitment`

Look up a single entry by its 64-char hex commitment.

- `404 NOT_FOUND` if no slot matches.
- `400 INVALID_COMMITMENT` if the path param is not 64 hex chars.

---

### `POST /api/v1/secrets/generate`

Mints a fresh 32-byte secret and its SHA-256 commitment.

```json
{
  "secret": "8f1c…",
  "commitment": "a3b0…"
}
```

> ⚠️  Generating the secret server-side means **D3FAULT sees it**. For real
> privacy, generate it client-side and only send the commitment to us.

---

### `POST /api/v1/tx/deposit-sol/build`

Builds an unsigned versioned transaction the depositor can sign and send.

**Request**

```json
{
  "depositor": "Dep0sit0r...",
  "amount": "1000000",
  "expiry": 1735689600,
  "commitment": "a3b0…"
}
```

**Response**

```json
{
  "tx": "<base64 versioned transaction>",
  "feeLamports": "5000",
  "commitment": "a3b0…"
}
```

Errors: `400 INVALID_REQUEST`, `400 INVALID_AMOUNT`, `503 PROGRAM_NOT_DEPLOYED`,
`500 BUILD_FAILED`.

---

### `POST /api/v1/tx/deposit-spl/build`

Same shape as `deposit-sol/build`, plus a `mint` field and an optional
`decimals` hint:

```json
{
  "depositor": "Dep0sit0r...",
  "mint": "EPjFWdd5...",
  "amount": "1500000",
  "decimals": 6,
  "expiry": 1735689600,
  "commitment": "a3b0…"
}
```

---

### `POST /api/v1/tx/withdraw`

Relayer-signed withdrawal — D3FAULT pays the gas. Reveal the secret and a
recipient pubkey; the relayer settles the funds on-chain.

**Request**

```json
{
  "secret": "8f1c…",
  "recipient": "Recipient..."
}
```

**Response**

```json
{
  "signature": "5xK…",
  "explorerUrl": "https://solscan.io/tx/5xK…?cluster=devnet"
}
```

Errors include `400 INVALID_REQUEST`, `400 INVALID_RECIPIENT`,
`404 COMMITMENT_NOT_FOUND`, `410 EXPIRED`, `500 RELAYER_NOT_CONFIGURED`,
`500 TX_FAILED`, `503 PROGRAM_NOT_DEPLOYED`.

---

### `GET /api/v1/price`

Looks up the current USD price of a Solana asset.

| Query  | Required | Description                                   |
| ------ | -------- | --------------------------------------------- |
| `mint` | yes      | SPL mint, or the SOL mint / system sentinel.  |

```json
{
  "mint": "So11111111111111111111111111111111111111112",
  "symbol": "SOL",
  "usdPrice": 142.7,
  "change24h": -1.34
}
```

SOL is sourced from CoinGecko; SPL tokens from DexScreener. Errors:
`400 MISSING_PARAM`, `404 NOT_FOUND`, `500 PRICE_ERROR`.

---

## Error shape

Every error response is a JSON object with `error` and `code` fields:

```json
{ "error": "Human readable message", "code": "MACHINE_CODE" }
```

Common codes:

| Code                    | HTTP | Meaning                                       |
| ----------------------- | ---- | --------------------------------------------- |
| `UNAUTHORIZED`          | 401  | Missing Bearer header.                        |
| `INVALID_KEY`           | 401  | Bad format or unknown key.                    |
| `KEY_REVOKED`           | 403  | The key was revoked.                          |
| `RATE_LIMITED`          | 429  | Per-minute budget exceeded.                   |
| `INVALID_REQUEST`       | 400  | Body / query failed validation.               |
| `NOT_FOUND`             | 404  | Resource does not exist.                      |
| `EXPIRED`               | 410  | Commitment claim window has passed.           |
| `PROGRAM_NOT_DEPLOYED`  | 503  | API points at the placeholder program id.    |
| `RELAYER_NOT_CONFIGURED`| 500  | Relayer keypair env var is missing.           |
| `TX_FAILED`             | 500  | On-chain submission failed.                   |
| `RPC_ERROR`             | 500  | Upstream Solana RPC failure.                  |

---

## Quickstart

### cURL

```bash
curl https://api.d3fault.app/api/v1/program \
  -H "Authorization: Bearer $DFK_KEY"
```

### TypeScript (fetch)

```ts
const res = await fetch("https://api.d3fault.app/api/v1/tx/deposit-sol/build", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.DFK_KEY}`,
  },
  body: JSON.stringify({
    depositor: wallet.publicKey.toBase58(),
    amount: "1000000",
    expiry: Math.floor(Date.now() / 1000) + 3600,
    commitment,
  }),
});
const { tx } = await res.json();
```

### Python (requests)

```python
import os, requests

r = requests.get(
    "https://api.d3fault.app/api/v1/store/commitments",
    headers={"Authorization": f"Bearer {os.environ['DFK_KEY']}"},
    params={"status": "active"},
)
r.raise_for_status()
print(r.json())
```

---

## Best practices

- **Generate secrets client-side.** The server never needs to see them.
- **Store keys in a secret manager**, not in source control or `.env` files
  committed to git.
- **Rotate regularly.** Mint a new key, deploy it, then revoke the old one.
- **Watch for `429`.** Back off with the `RateLimit-Reset` value rather than a
  fixed sleep.
- **Pin `expiry` conservatively** (a few minutes to a few hours) so unclaimed
  funds become recoverable quickly.

---

## Versioning

The path prefix (`/v1`) is the version. We will introduce `/v2` for any
breaking change and keep `/v1` running for at least 6 months after that
announcement. Additive changes (new fields, new endpoints) ship in place under
`/v1`.

## Support

- **Docs / status:** see `docs/status.md` in this repo.
- **Bugs / feature requests:** open an issue on the project tracker.
- **Security disclosures:** email `security@d3fault.app` — please do not file
  public issues for vulnerabilities.
