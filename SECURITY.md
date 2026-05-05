# D3FAULT Production Security Policy

This document outlines the security practices, policies, and procedures for the D3FAULT production deployment, including the API server, frontend application, and infrastructure.

---

## Executive Summary

**Current Status:** 🚀 **Production Ready** (with monitoring & incident response in place)

This repository contains the **API Server** (Express + Node.js), **Frontend** (React + Vite), and **shared libraries** for the D3FAULT privacy transfer protocol. Security is a shared responsibility between development, operations, and users.

**Key Security Areas:**
- ✅ API authentication & rate limiting
- ✅ Environment variable management
- ✅ Dependency security scanning
- ✅ HTTPS/TLS enforcement
- ✅ Database security (Drizzle ORM + PostgreSQL)
- ✅ Incident response procedures

---

## Reporting Security Vulnerabilities

### Responsible Disclosure

If you discover a security vulnerability in D3FAULT, **please do not open a public GitHub issue**. Instead:

1. **Email:** security@d3fault.sh (if available) or contact the maintainers privately
2. **Provide:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if applicable)
3. **Timeline:** We aim to respond within 48 hours and patch within 7 days for critical issues

### Security Bounty

We may offer bounties for valid security findings. Contact the maintainers for details.

---

## Architecture Security

### API Server (`artifacts/api-server`)

**Framework:** Express 5 + Node.js 24

**Security Features:**
- ✅ CORS configuration (configurable origins)
- ✅ Request validation (Zod schemas)
- ✅ Rate limiting (10 req/min per IP)
- ✅ API key authentication (via Privy)
- ✅ JWT token validation
- ✅ Request/response logging (via Pino)
- ✅ Error handling (no stack traces in production)
- ✅ Helmet.js recommended (not enforced; add if needed)

**Key Endpoints:**
```
GET  /api/healthz                    — Liveness probe (no auth required)
GET  /api/v1/program                 — Program metadata
GET  /api/v1/store/commitments       — List commitments (read-only)
POST /api/v1/tx/deposit-sol/build    — Build unsigned deposit TX
POST /api/v1/tx/deposit-spl/build    — Build unsigned SPL deposit TX
POST /api/v1/tx/withdraw             — Relayer-signed withdrawal
GET  /api/v1/auth/keys               — API key management
```

**Auth Mechanisms:**
1. **Bearer Token (API Key):**
   ```
   Authorization: Bearer <api-key>
   ```
   - Validated against Privy API
   - User must have created the key via web UI

2. **Privy JWT:**
   ```
   Authorization: Bearer <privy-jwt>
   ```
   - Validated using Privy SDK
   - Includes user claims (wallet address, etc.)

**Rate Limiting:**
- 10 requests per minute per IP
- Applies to all `/api/v1/` endpoints
- Stored in-memory (reset on server restart)
- **Recommendation:** Use Redis for distributed rate limiting in multi-instance setup

### Frontend (`artifacts/d3fault-web`)

**Framework:** React 19 + Vite + TailwindCSS v4

**Security Features:**
- ✅ Content Security Policy (CSP) headers recommended
- ✅ No sensitive data stored in localStorage (use sessionStorage)
- ✅ Secure wallet integration (Privy + Solana adapters)
- ✅ HTTPS enforcement (via server config)
- ✅ Subresource Integrity (SRI) for CDN assets
- ✅ XSS protection (React auto-escapes by default)

**Key Security Practices:**
1. **Environment Variables:**
   - `VITE_API_BASE_URL` — API endpoint (no secrets)
   - `VITE_PRIVY_APP_ID` — Privy app ID (public)
   - `VITE_SOLANA_NETWORK` — Network (mainnet-beta or devnet)

2. **Wallet Security:**
   - Privy handles key management (non-custodial)
   - Never ask users to paste private keys
   - Validate transaction details before signing

3. **Claim Link Security:**
   - Secret stored in URL hash fragment (`#<secretHex>`)
   - Hash is never sent to servers
   - Recipient should verify claim amount before claiming

### Shared Libraries

**`lib/d3fault-shared`** (Commitment helpers)
- SHA-256 computations
- Secret/commitment generation
- Claim URL building
- No external API calls

**`lib/api-spec`** (OpenAPI spec)
- Single source of truth for REST contract
- Auto-generates client hooks & Zod schemas
- Enables type safety across stack

**`lib/api-zod`** (Validation)
- Request/response validation
- Generated from OpenAPI spec
- Used by API server for input validation

**`lib/db`** (Database)
- Drizzle ORM (type-safe SQL)
- Schema-driven (migrations in code)
- PostgreSQL only

---

## Dependency Security

### Production Dependencies

| Package | Version | Purpose | Security Status |
|---------|---------|---------|-----------------|
| `express` | 5.x | HTTP framework | ✅ Actively maintained |
| `@coral-xyz/anchor` | 0.31.1 | Solana integration | ✅ Audited |
| `@solana/web3.js` | ^1.18 | Solana client | ✅ Audited |
| `@privy-io/react-auth` | latest | Wallet auth | ✅ Security-focused |
| `drizzle-orm` | latest | Database ORM | ✅ Type-safe |
| `zod` | v4 | Input validation | ✅ Battle-tested |
| `pino` | ^8 | Structured logging | ✅ High-performance |

### Vulnerability Scanning

**Setup automatic scanning:**

```bash
# Install dependencies check tool
npm install --save-dev npm-audit

# Run audit (included in npm/pnpm by default)
pnpm audit

# Upgrade vulnerable packages
pnpm audit --fix
```

**CI/CD Integration:**
```yaml
# Add to your CI pipeline (GitHub Actions, GitLab CI, etc.)
- run: pnpm audit --audit-level=moderate
```

### Pinned vs. Flexible Versions

**Current approach:** Flexible versions with `^` and `~`
- Allows security patches to be installed automatically
- Pin to specific versions only for critical dependencies

**Recommendation:**
- Use `pnpm` to lock versions in `pnpm-lock.yaml`
- Review `pnpm-lock.yaml` before merging dependency PRs
- Run `pnpm audit` in CI/CD

---

## Environment Variables & Secrets

### Required Secrets (Never Commit)

**API Server** (`.env`):
```bash
# Database
DATABASE_URL=postgres://user:pass@host:5432/d3fault

# Privy
PRIVY_APP_ID=<your-privy-app-id>
PRIVY_SECRET_KEY=<your-privy-secret-key>

# Solana
PROGRAM_ID=2akvmbaGhGeAWVCQrpHXvJTZE9EksMk5rpHM4NcMmfKG
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_ENDPOINT=https://api.mainnet-beta.solana.com

# Relayer
RELAYER_PRIVATE_KEY=<deployer-keypair-bytes>
RELAYER_ADDRESS=<deployer-public-key>

# Server
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
```

**Frontend** (`.env.local`):
```bash
VITE_API_BASE_URL=https://api.d3fault.sh
VITE_PRIVY_APP_ID=<your-privy-app-id>
VITE_SOLANA_NETWORK=mainnet-beta
```

### Secret Management Best Practices

1. **Never commit `.env` files** — use `.env.example` instead
2. **Rotate secrets regularly** — especially API keys and private keys
3. **Use secrets manager** — GitHub Secrets, AWS Secrets Manager, HashiCorp Vault, etc.
4. **Audit secret access** — log who accessed what and when
5. **Principle of least privilege** — each service only has secrets it needs

### Example: GitHub Secrets Setup

```yaml
# .github/workflows/deploy.yml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  PRIVY_SECRET_KEY: ${{ secrets.PRIVY_SECRET_KEY }}
  RELAYER_PRIVATE_KEY: ${{ secrets.RELAYER_PRIVATE_KEY }}
```

---

## Database Security

### PostgreSQL Configuration

**Recommended Settings:**
```sql
-- Enable SSL
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'

-- Enforce strong authentication
password_encryption = scram-sha-256

-- Connection limits
max_connections = 100
max_prepared_transactions = 100
```

**Connection String:**
```
postgres://user:password@host:5432/db?sslmode=require
```

### Drizzle ORM Best Practices

1. **Use parameterized queries** (automatic in Drizzle)
   ```typescript
   // ✅ Safe — parameterized
   db.select().from(users).where(eq(users.email, userEmail))
   
   // ❌ Dangerous — SQL injection risk
   db.execute(`SELECT * FROM users WHERE email = '${userEmail}'`)
   ```

2. **Validate input with Zod** before database operations
3. **Use transactions** for multi-step operations
4. **Enable migrations** tracking (Drizzle handles this)

### Backup & Recovery

- **Daily automated backups** (at minimum)
- **Test backup restoration** monthly
- **Store backups encrypted** at rest
- **Keep backups off-site** (separate cloud region)
- **Retention policy:** 30 days minimum, 90 days recommended

---

## API Security Hardening

### HTTPS Enforcement

**Always use HTTPS in production:**
```javascript
// Force HTTPS
app.use((req, res, next) => {
  if (req.header('x-forwarded-proto') !== 'https') {
    res.redirect(`https://${req.header('host')}${req.url}`);
  }
  next();
});
```

### CORS Configuration

```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'https://d3fault.sh',
    'https://www.d3fault.sh',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 3600, // Pre-flight cache: 1 hour
}));
```

### Security Headers (Recommended)

```javascript
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // CSP for frontend
  res.setHeader('Content-Security-Policy', "default-src 'self'");
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  next();
});
```

### Request Validation

```typescript
// Example: Validate withdrawal request
import { z } from 'zod';

const withdrawRequest = z.object({
  secret: z.string().regex(/^[0-9a-f]{64}$/i, 'Invalid secret'),
  recipient: z.string().regex(/^[1-9A-HJ-NP-Z]{43,44}$/, 'Invalid Solana address'),
});

// Use in endpoint
app.post('/api/v1/tx/withdraw', (req, res) => {
  const parsed = withdrawRequest.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid request', details: parsed.error });
  }
  // Process validated data
});
```

---

## Logging & Monitoring

### What to Log (Security-Relevant)

✅ **DO log:**
- Failed authentication attempts
- Rate limit violations
- Authorization failures (403)
- Invalid input (malformed requests)
- Database errors (without sensitive data)
- API key changes
- Deployment events

❌ **DON'T log:**
- Passwords or API keys
- Private keys or secrets
- Full request/response bodies
- Personally identifiable information (PII)
- Wallet private keys

### Pino Configuration

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // Redact sensitive fields
  redact: {
    paths: [
      'req.headers.authorization',
      'secret',
      'privateKey',
      'password',
    ],
    remove: true,
  },
  // Pretty print in development
  transport: process.env.NODE_ENV === 'development'
    ? { target: 'pino-pretty' }
    : undefined,
});
```

### Monitoring & Alerting

**Key metrics to monitor:**

```
API Server:
- Request latency (p50, p95, p99)
- Error rate by status code (4xx, 5xx)
- Authentication failures
- Rate limit violations
- RPC call latency & errors

Database:
- Query latency
- Connection count
- Slow query logs

Infrastructure:
- CPU usage (alert if > 80%)
- Memory usage (alert if > 85%)
- Disk usage (alert if > 90%)
- Network I/O
```

**Recommended tools:**
- DataDog, New Relic, or CloudWatch for APM
- PagerDuty for alerting & on-call
- Sentry for error tracking

---

## Incident Response

### Critical Issues

If a security incident occurs:

1. **Immediate Actions (< 5 minutes):**
   - Declare incident severity
   - Page on-call security engineer
   - Assess impact (data exposure? funds at risk? service down?)

2. **Containment (5-15 minutes):**
   - Isolate affected system if possible
   - Revoke compromised credentials
   - Enable enhanced logging
   - Pause automated deployments

3. **Investigation (15+ minutes):**
   - Collect forensic logs
   - Identify root cause
   - Assess scope of compromise
   - Notify stakeholders if user data affected

4. **Recovery (1-24 hours):**
   - Deploy patch or hotfix
   - Restore from clean backup if needed
   - Verify integrity post-recovery
   - Gradually restore service

5. **Post-Incident (24-72 hours):**
   - Conduct blameless post-mortem
   - Document findings & actions taken
   - Implement preventative measures
   - Update runbooks & playbooks

### Incident Communication

- **Internal:** Slack #security channel (real-time updates)
- **Status Page:** Update d3fault.sh/status if service affected
- **Users:** Email affected users within 24 hours if data breach
- **Regulators:** Notify as required by jurisdiction (if applicable)

### Sample Incident Playbook

**API Key Compromised:**
1. Revoke the key immediately
2. Audit audit logs for unauthorized access
3. If funds were stolen, verify on-chain
4. Reset Privy API secret if needed
5. Notify user to create new API key

**Database Breach:**
1. Isolate database from network
2. Take forensic snapshot
3. Spin up clean database from backup
4. Restore service
5. Audit database access logs
6. Notify users per GDPR/CCPA

---

## Third-Party Security

### Privy Integration

- ✅ Non-custodial (you control your keys)
- ✅ OAuth-based (secure authentication)
- ✅ Regularly audited
- ⚠️ Validate JWT tokens server-side

**Recommended Check:**
```typescript
// Verify JWT token signature and expiry
const verifyPrivyToken = async (token: string) => {
  try {
    const decoded = await privy.verifyToken(token);
    if (decoded.exp < Date.now() / 1000) {
      throw new Error('Token expired');
    }
    return decoded;
  } catch (err) {
    throw new Error('Invalid token');
  }
};
```

### Solana RPC Security

**Use paid RPC (not public endpoints):**
- Public RPC: Rate-limited, unreliable
- Paid RPC (Helius, Alchemy, QuickNode): Private, dedicated, monitored

**RPC Selection:**
```
Production:  https://mainnet.helius-rpc.com/?api-key=<key>
Staging:     https://devnet.helius-rpc.com/?api-key=<key>
```

---

## Compliance & Standards

### Standards Compliance

- ✅ **OWASP Top 10:** Addressed in this document
- ✅ **CWE/SANS Top 25:** Input validation, auth, encryption
- ✅ **OAuth 2.0:** Via Privy integration
- ✅ **HTTPS/TLS 1.3:** Required for production

### Data Protection

**User Data Collected:**
- Wallet address (public, on-chain)
- API key usage (request logs)
- Transaction history (only visible to relayer)

**Data Retention:**
- Transaction logs: 90 days minimum, 1 year recommended
- API audit logs: 1 year minimum
- Deleted user data: Securely erased, no recovery

**GDPR Compliance** (if users in EU):
- Right to access: Provide data export on request
- Right to erasure: Delete user data (keep transaction history for audit)
- Privacy policy: Clearly disclose data practices
- DPA: Have Data Processing Agreement with Privy & cloud provider

### PCI DSS (if handling payment cards)

- ❌ **D3FAULT does NOT handle payment cards**
- ✅ Only handles crypto (Solana), no PCI compliance needed

---

## Security Checklist: Pre-Production

Before deploying to mainnet, ensure:

### Code Security
- [ ] Dependency audit passing (`pnpm audit`)
- [ ] All secrets removed from code
- [ ] `.env.example` created (no real values)
- [ ] Security testing completed
- [ ] Code review by security engineer

### Infrastructure
- [ ] HTTPS/TLS 1.3 enabled
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] DDoS protection (Cloudflare or equivalent)
- [ ] WAF (Web Application Firewall) configured
- [ ] Monitoring & alerting active

### Secrets & Access
- [ ] All secrets in secrets manager (not environment files)
- [ ] Database password rotated
- [ ] API keys created for each service
- [ ] SSH keys rotated
- [ ] 2FA enabled for all admin accounts

### Database
- [ ] Database encrypted at rest
- [ ] Automated backups enabled
- [ ] Backup restoration tested
- [ ] Connection SSL/TLS enforced
- [ ] Query logging enabled

### Operations
- [ ] Incident response plan documented
- [ ] On-call rotation established
- [ ] Runbooks created for common scenarios
- [ ] Post-mortem process defined
- [ ] Disaster recovery tested

### Documentation
- [ ] README with setup instructions
- [ ] Deployment guide
- [ ] Runbook for incident response
- [ ] Security policy document (this file!)
- [ ] Dependency management policy

---

## Continuous Security

### Regular Activities

**Weekly:**
- Review error logs for suspicious patterns
- Check monitoring dashboards
- Verify backups succeeded

**Monthly:**
- Rotate API keys
- Audit API key usage
- Review access logs
- Security team meeting

**Quarterly:**
- Penetration testing
- Dependency audit (`pnpm audit`)
- Disaster recovery drill
- Security training

**Annually:**
- Third-party security audit
- Architecture review
- Compliance audit (if applicable)
- Renewal of TLS certificates (auto-renewal recommended)

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security](https://expressjs.com/en/advanced/best-practice-security.html)
- [React Security](https://react.dev/learn#security)
- [Solana Security](https://docs.solana.com/developers/security)
- [Privy Security](https://docs.privy.io/guide/frontend/security)

---

## Contact & Support

- **Security Issues:** security@d3fault.sh (or contact maintainers)
- **Questions:** Open a GitHub discussion or issue (non-sensitive)
- **Status:** https://status.d3fault.sh

---

**Document Version:** 1.0  
**Last Updated:** May 5, 2026  
**Next Review:** August 5, 2026  
