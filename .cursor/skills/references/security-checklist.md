# Security Checklist

Quick reference for web application security. Use alongside the [security-and-hardening](../security-and-hardening/SKILL.md) skill.

> **Mada Graphite mapping:** this project uses Supabase Auth + RLS + Server Actions — many generic checks below (bcrypt, JWT, express, helmet) are handled by Supabase or Next.js automatically. See [security-and-hardening](../security-and-hardening/SKILL.md) for project-specific guidance; use this checklist for items not covered there.

## Table of Contents

- [Pre-Commit Checks](#pre-commit-checks)
- [Authentication](#authentication)
- [Authorization](#authorization)
- [Input Validation](#input-validation)
- [Security Headers](#security-headers)
- [CORS Configuration](#cors-configuration)
- [Data Protection](#data-protection)
- [Dependency Security](#dependency-security)
- [Error Handling](#error-handling)
- [OWASP Top 10 Quick Reference](#owasp-top-10-quick-reference)

## Pre-Commit Checks

- [ ] No secrets in code (`git diff --cached | grep -i "password\|secret\|api_key\|token"`)
- [ ] `.gitignore` covers: `.env`, `.env.local`, `*.pem`, `*.key`
- [ ] `.env.example` uses placeholder values (not real secrets)

## Authentication

> In this project, Supabase Auth handles hashing, cookies, session expiration, and password reset tokens. The items below mostly apply if you ever introduce a custom auth path.

- [x] Passwords hashed (handled by Supabase Auth — argon2 by default)
- [x] Session cookies `httpOnly`, `secure`, `sameSite` (handled by `@supabase/ssr`)
- [ ] Session expiration configured in Supabase dashboard (Authentication → Settings)
- [ ] Rate limiting on login endpoint (Supabase has built-in; tune in Auth settings)
- [x] Password reset tokens time-limited (Supabase default ~1 hour)
- [ ] Google OAuth env config verified: `npm run qa:oauth`
- [ ] MFA: not enabled by default; track in `docs/ROADMAP.md` if needed

## Authorization

> In this project, RLS is the primary boundary. JS-level checks are a defense-in-depth layer, not the source of truth.

- [ ] Every new table has RLS enabled + explicit policies in its migration
- [ ] Buyer/seller/admin separation enforced via `profiles.role` in policy expressions
- [ ] `src/proxy.ts` admin gate covers `/admin/**` (verify after touching it)
- [ ] `npm run qa:verify-rls` exit 0 after any RLS change
- [ ] `SUPABASE_SERVICE_ROLE_KEY` only used where RLS bypass is intentional and audited

## Input Validation

- [ ] All user input validated at system boundaries (API routes, form handlers)
- [ ] Validation uses allowlists (not denylists)
- [ ] String lengths constrained (min/max)
- [ ] Numeric ranges validated
- [ ] Email, URL, and date formats validated with proper libraries
- [ ] File uploads: type restricted, size limited, content verified
- [ ] SQL queries parameterized (no string concatenation)
- [ ] HTML output encoded (use framework auto-escaping)
- [ ] URLs validated before redirect (prevent open redirect)

## Security Headers

> Next.js + Vercel sets sensible defaults. Configure overrides in `next.config.ts` if you need stricter CSP. There is currently no app-level CSP override in this repo — adding one requires explicit user approval.

```
Strict-Transport-Security: max-age=31536000; includeSubDomains (Vercel)
X-Content-Type-Options: nosniff (Next.js default)
Referrer-Policy: strict-origin-when-cross-origin (Next.js default)
Content-Security-Policy: not currently set — flag if you need one
```

## CORS

> All public-facing endpoints in this project are same-origin (Server Actions + Route Handlers under `/api/chat`). CORS only matters if you add a public webhook or cross-origin route. For Supabase, the JS client handles auth; do not add CORS allowlists for it.

## Data Protection

- [ ] Sensitive fields excluded from API responses (`passwordHash`, `resetToken`, etc.)
- [ ] Sensitive data not logged (passwords, tokens, full CC numbers)
- [ ] PII encrypted at rest (if required by regulation)
- [ ] HTTPS for all external communication
- [ ] Database backups encrypted

## Dependency Security

```bash
# Audit dependencies
npm audit

# Fix automatically where possible
npm audit fix

# Check for critical vulnerabilities
npm audit --audit-level=critical

# Keep dependencies updated
npx npm-check-updates
```

## Error Handling

```typescript
// Production: generic error, no internals
res.status(500).json({
  error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' }
});

// NEVER in production:
res.status(500).json({
  error: err.message,
  stack: err.stack,         // Exposes internals
  query: err.sql,           // Exposes database details
});
```

## OWASP Top 10 Quick Reference

| # | Vulnerability | Prevention |
|---|---|---|
| 1 | Broken Access Control | Auth checks on every endpoint, ownership verification |
| 2 | Cryptographic Failures | HTTPS, strong hashing, no secrets in code |
| 3 | Injection | Parameterized queries, input validation |
| 4 | Insecure Design | Threat modeling, spec-driven development |
| 5 | Security Misconfiguration | Security headers, minimal permissions, audit deps |
| 6 | Vulnerable Components | `npm audit`, keep deps updated, minimal deps |
| 7 | Auth Failures | Strong passwords, rate limiting, session management |
| 8 | Data Integrity Failures | Verify updates/dependencies, signed artifacts |
| 9 | Logging Failures | Log security events, don't log secrets |
| 10 | SSRF | Validate/allowlist URLs, restrict outbound requests |
