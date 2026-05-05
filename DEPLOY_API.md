# Publishing the API Server to `api.d3fault.sh`

This guide walks you through publishing the **API Server** artifact as its own
deployment and pointing the custom subdomain `api.d3fault.sh` at it. The web
app (`D3FAULT`) stays on its own deployment — this only deploys the API.

The API Server has already been prepared for deployment:

- It binds to the `PORT` environment variable (Replit injects this).
- It has a production build (`pnpm --filter @workspace/api-server run build`)
  and a production start command that runs the bundled `dist/index.mjs`
  directly (no `pnpm` wrapper, faster cold starts).
- It exposes a healthcheck at **`GET /api/healthz`** that returns
  `{"status":"ok"}`. Replit uses this as the startup probe.

You don't need to change any code. Just follow the steps below.

---

## 1. Open the Publish dialog and pick the API Server

1. In the Replit workspace, click the **Publish** button in the top‑right.
2. When asked which artifact to publish, choose **`API Server`** (not
   `D3FAULT` and not `Canvas`).
3. For deployment type, choose **Autoscale**.
   - Autoscale is the right pick for a stateless HTTP API: it scales to zero
     when idle, scales out under load, and you only pay for requests served.
   - Pick **Reserved VM** instead only if you later add: long‑lived
     WebSockets, background workers/cron, or in‑memory state that must
     persist between requests. The current API has none of those.
4. Leave the build and run commands at their defaults — they're already
   configured in `artifacts/api-server/.replit-artifact/artifact.toml`:
   - **Build:** `pnpm --filter @workspace/api-server run build`
   - **Run:** `node --enable-source-maps artifacts/api-server/dist/index.mjs`
   - **Healthcheck path:** `/api/healthz`

Don't click **Deploy** yet — set the secrets first (next step).

---

## 2. Set the production secrets

Open the deployment's **Secrets** tab (in the Publish dialog, before the
first deploy) and add every value below. Anything marked *(secret)* must be
set here — do **not** put it in `.replit` or commit it.

Required:

| Key                    | Example / Notes                                                                 |
| ---------------------- | ------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Provisioned automatically when you attach a Replit Postgres DB to the deploy.   |
| `SOLANA_NETWORK`       | `mainnet-beta`                                                                  |
| `SOLANA_RPC_ENDPOINT`  | Your Helius (or other) mainnet RPC URL, e.g. `https://mainnet.helius-rpc.com/?api-key=…` |
| `PROGRAM_ID`           | `2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG`                                   |
| `RELAYER_PRIVATE_KEY`  | *(secret)* JSON byte‑array of the relayer wallet's secret key — the exact contents of a Solana keypair file, e.g. `[12,34,56,…,201]` (64 numbers). This is what `solana-keygen new -o relayer.json` writes; paste the file contents verbatim. **Not** base58 — the server does `JSON.parse(...)` then `Keypair.fromSecretKey(Uint8Array.from(...))`, so anything other than a JSON number array will fail at runtime. |
| `PRIVY_APP_ID`         | Your Privy app ID (used to verify user auth tokens).                            |
| `PRIVY_APP_SECRET`     | *(secret)* Your Privy app secret.                                                |

Optional / nice‑to‑have:

| Key                      | Notes                                                              |
| ------------------------ | ------------------------------------------------------------------ |
| `SOLANA_RPC_ENDPOINT_2`  | Secondary RPC URL used as a fallback for read‑heavy calls.         |
| `LOG_LEVEL`              | Defaults to `info`. Set to `debug` while bringing up the deploy.   |

`PORT` and `NODE_ENV` are set automatically by the deployment config — don't
add them as secrets.

---

## 3. First deploy

1. Confirm the secrets above are filled in.
2. If you haven't already, attach the production Postgres database in the
   deployment's **Database** tab so `DATABASE_URL` is wired up.
3. Click **Deploy**.
4. Wait for the build and the startup healthcheck to pass. You'll see a
   default URL like `https://<some-slug>.replit.app`. Sanity‑check it:

   ```sh
   curl https://<some-slug>.replit.app/api/healthz
   # → {"status":"ok"}
   ```

If healthcheck fails, open the deployment **Logs** tab — the most common
causes are a missing secret (the server throws on startup) or `DATABASE_URL`
not being attached.

---

## 4. Add `api.d3fault.sh` as a custom domain

1. In the deployment, open **Settings → Domains** (sometimes labeled
   "Custom domains").
2. Click **Link a domain** and enter: `api.d3fault.sh`
3. Replit will show you **two DNS records** to add at your domain registrar
   (the place where you manage `d3fault.sh` — e.g. Namecheap, Cloudflare,
   Google Domains, GoDaddy). They will look like this (the exact target
   value and TXT string are shown in the Replit UI — copy them from there,
   don't guess):

   **Record 1 — points the subdomain at Replit (A or CNAME):**

   | Type    | Host / Name | Value (from Replit UI)              | TTL       |
   | ------- | ----------- | ----------------------------------- | --------- |
   | `A`     | `api`       | e.g. `34.xxx.xxx.xxx`               | Automatic |
   |  *or*   |             |                                     |           |
   | `CNAME` | `api`       | e.g. `<slug>.replit.app.`           | Automatic |

   Use whichever record type Replit shows you. If both are offered, prefer
   `CNAME` unless your registrar doesn't allow CNAME on a subdomain
   (most do).

   **Record 2 — proves you own the domain (TXT):**

   | Type  | Host / Name           | Value (from Replit UI)                       | TTL       |
   | ----- | --------------------- | -------------------------------------------- | --------- |
   | `TXT` | `_replit-verify.api`  | e.g. `replit-verify=abc123…` (long string)   | Automatic |

   > Note: some registrars want just `api` in the **Host** field and append
   > `.d3fault.sh` automatically; others want the full
   > `api.d3fault.sh`. Same for the TXT host. If unsure, follow what the
   > registrar's UI prompts for and match the resulting full hostname shown
   > in their preview.

4. Save the records at the registrar.
5. Back in Replit, click **Verify** (or wait — Replit re‑checks
   automatically). DNS propagation usually takes a few minutes but can take
   up to an hour. Once verified, Replit auto‑provisions an HTTPS
   certificate.

---

## 5. Verify `api.d3fault.sh` is live

Once the domain shows as **Active** with a green check in the deployment
settings, run:

```sh
curl -i https://api.d3fault.sh/api/healthz
```

You should see:

- `HTTP/2 200`
- A valid TLS certificate (no warnings)
- Body: `{"status":"ok"}`

You can also try a real endpoint, e.g.:

```sh
curl https://api.d3fault.sh/api/program-info
```

If you get `200`s back, you're done. The API is live on `api.d3fault.sh`.

---

## Troubleshooting cheatsheet

- **Healthcheck never passes after deploy.** Check the deployment Logs tab.
  Almost always a missing secret. The server throws explicitly with the
  name of the missing variable on startup (e.g. `PORT`, `DATABASE_URL`).
- **Domain stuck on "Pending verification".** The TXT record isn't visible
  yet. Check with `dig TXT _replit-verify.api.d3fault.sh +short` — if it
  returns nothing, the registrar hasn't propagated yet (wait) or the host
  field was entered wrong (some registrars need `_replit-verify.api`,
  others want the full `_replit-verify.api.d3fault.sh`).
- **`curl` to `api.d3fault.sh` returns the wrong app.** You probably pointed
  the `A`/`CNAME` at the web app deployment instead of the API deployment.
  Re‑check the value in Replit's **Domains** screen for the API Server
  deployment specifically.
- **`DATABASE_URL must be set` in logs.** Attach the production Postgres
  DB in the deployment's **Database** tab and redeploy.
