# D3FAULT Status Page — Spec

This document specifies the public **status page** at `status.d3fault.app`. It
covers what we monitor, how state is computed, what visitors see, and the
contracts a future implementation must satisfy. The actual UI is **not** built
yet — this is the design reference.

---

## Goals

1. Give developers a one-glance answer to "is D3FAULT up right now?".
2. Show recent uptime and any active or past incidents transparently.
3. Let teams subscribe to be notified about new incidents and maintenance.
4. Be self-contained — readable even if the main app is down.

## Non-goals

- Replacing internal observability (Grafana, Loki, alerting). Those stay
  internal.
- Showing per-customer usage or quotas — that lives in the dashboard.

---

## Layout

A single scrollable page with the following sections, top to bottom:

1. **Global banner** — large pill summarizing overall status:
   - 🟢 *All systems operational*
   - 🟡 *Partial outage — some components degraded*
   - 🔴 *Major outage*
   - 🛠️ *Scheduled maintenance in progress*
2. **Components grid** — one row per monitored component with current state
   and a 90-day uptime sparkline.
3. **Live metrics panel** — 24h request volume and error-rate chart.
4. **Active incidents** — expanded cards if any are open.
5. **Incident history** — chronological list, paginated.
6. **Scheduled maintenance** — upcoming windows.
7. **Subscribe** — email + webhook signup.
8. **Footer** — last-updated timestamp, RSS link, contact.

---

## Components to monitor

| Component         | Source of truth                                       |
| ----------------- | ----------------------------------------------------- |
| Public API (v1)   | `GET /api/v1/program` synthetic probe (every 30s).    |
| Dashboard web app | `GET /` synthetic probe (every 60s).                  |
| Relayer service   | Successful test `tx/withdraw` against canary deposit. |
| Solana RPC pool   | `withRpcFallback` health pings to each upstream.      |
| Database          | API server's `/healthz` extended with a `SELECT 1`.   |

Each component is independently scored so a Solana RPC outage doesn't make
the dashboard look down.

---

## Status states

A component can be in one of:

| State          | Definition                                                    |
| -------------- | ------------------------------------------------------------- |
| `operational`  | All probes in the last 5 min succeeded.                       |
| `degraded`     | <50% of probes failed, or p95 latency > 2× baseline.          |
| `partial`      | ≥50% failed but some succeeded.                               |
| `major`        | All probes failed for ≥3 minutes.                             |
| `maintenance`  | A scheduled window is currently active for this component.    |

The **global banner** is the worst state across all components, with
`maintenance` taking precedence when an active window exists.

---

## Live metrics panel

- **Requests / minute** — line chart, last 24h, sourced from `api_usage`.
- **Error rate (% 4xx+5xx)** — overlay on the same chart.
- **p50 / p95 latency** — sourced from probe timings.
- Refreshes every 30 seconds via a small JSON endpoint
  (`/status/api/metrics`).

This panel is informational; it does **not** drive the status badge.

---

## Incidents

### Lifecycle

1. **Investigating** — created automatically when a component flips to
   `partial`/`major` for >3 min, or manually by an operator.
2. **Identified** — root cause found.
3. **Monitoring** — fix deployed, watching probes recover.
4. **Resolved** — all components green for ≥10 min.

Each transition is a timestamped update visible on the page.

### Card contents

- Title (e.g. "Elevated 5xx on Public API")
- Affected components (chips)
- Severity (`minor` / `major` / `critical`)
- Started at, resolved at (if any), total duration
- Reverse-chronological updates with markdown body

### History

- Last 90 days inline, paginated 10 per page.
- Older incidents available via "Show all" link.
- RSS feed at `/status/feed.xml`.

---

## 90-day uptime history

Each component row shows 90 squares (one per day):

- 🟩 100% probes succeeded
- 🟨 some failures, no incident filed
- 🟧 incident filed (minor/major)
- 🟥 critical incident

Hovering a square shows the date, uptime %, and any incident links.

---

## Scheduled maintenance

- Operators schedule windows in the internal admin tool.
- Each window has: title, components, start, end, description.
- Shown in a dedicated section ≥48h ahead.
- Subscribers get notified at creation, 24h before, and at start/end.
- During the window the affected components show `maintenance` and are
  excluded from the day's uptime calculation.

---

## Subscriptions

Visitors can subscribe to updates via:

- **Email** — double opt-in confirmation; one address can subscribe to
  "all updates", a single component, or "incidents only".
- **Webhook** — signed JSON POST per update; payload mirrors the incident card.
- **RSS** — `/status/feed.xml`, no auth required.
- **Atom** — `/status/feed.atom`.

Unsubscribe links are in every email. Webhook signatures use HMAC-SHA256 with
a per-subscription secret returned at creation time.

---

## Data sources

| Data                  | Source                                    | Retention |
| --------------------- | ----------------------------------------- | --------- |
| Probe results         | Internal probe runner → `status_probes`   | 90 days   |
| Request/error counts  | `api_usage` table (already in the app DB) | 30 days   |
| Incidents & updates   | `status_incidents`, `status_updates`      | Forever   |
| Maintenance windows   | `status_maintenance`                      | Forever   |
| Subscribers           | `status_subscribers`                      | Until unsub |

The status app reads from a **read replica** so it stays available even when
the primary database is in trouble.

---

## Implementation notes

- Host on a separate domain/subdomain (`status.d3fault.app`) and a separate
  region from the main app to reduce blast radius.
- Cache the rendered page and JSON endpoints aggressively (5–10s edge cache);
  the page must survive a thundering herd during outages.
- All times displayed in the visitor's local timezone with a UTC tooltip.
- Page must be fully readable without JavaScript (server-render the latest
  snapshot); JS is only used for live refresh and charts.
- Accessibility: every status color must be paired with an icon + text label.

---

## SLO targets (reference)

| Component       | Monthly availability target |
| --------------- | --------------------------- |
| Public API      | 99.9%                       |
| Dashboard       | 99.5%                       |
| Relayer         | 99.5%                       |
| Status page     | 99.99% (separate stack)     |

These are **targets**, not contractual SLAs.

---

## Out of scope

- Per-customer health views.
- Real-time chat / on-call paging from the public page.
- Automatic refunds / credits — handled by support, not the status page.
- Historical metrics older than 30 days (kept in internal observability only).
