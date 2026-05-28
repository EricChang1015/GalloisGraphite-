---
name: security-and-hardening
description: Hardens Server Actions, RLS, uploads, payment verification, and auth flows in this Supabase + Next.js 16 platform. Use when handling user input, modifying RLS policies, adding file uploads, changing payment verification, or touching anything under src/proxy.ts or src/actions/*.
---

# Security and Hardening (Mada Graphite)

## When to use

- Adding or modifying any server action in `src/actions/**`
- Writing a migration that touches RLS policies
- Adding a file upload (Supabase Storage)
- Changing payment submission / verification flow
- Modifying `src/proxy.ts` (admin role gate)
- Adding a new external integration (POE API, SES SMTP, SMS gateway)
- Handling KYC documents, contracts, or any PII

## Three-tier boundary (project-specific)

### Always do

- **Validate every input with zod** at the server action boundary (`src/actions/*`)
- **Use the SSR Supabase client** (`@/lib/supabase/server`) inside server actions — never the service-role client unless explicitly needed
- **Rely on RLS** for row-level authorization; do not duplicate checks in JS
- **Append to `orders.timeline`** on every order state transition
- **Append to `audit_logs`** on every admin action
- **Restrict uploads** to `image/*` or `application/pdf` with size limit
- **Return `{ data, error }`** from server actions — never throw a raw error to the UI
- **Keep `SUPABASE_SERVICE_ROLE_KEY` server-only** — never imported into a Client Component
- **Keep contract / email bodies in English** (business decision — do not translate)

### Ask first

- Adding a new role or changing role enum (`profiles.role`)
- Changing RLS on `payments`, `orders`, `payment_schedules`, `profiles`, or `audit_logs`
- Touching `src/proxy.ts` admin gating
- Adding a new external service env var
- Lowering the KYC level required for any action (`/admin/settings → KYC thresholds`)
- Allowing a wider upload type / larger size
- Adding a new endpoint that uses the service-role client

### Never do

- **Never commit secrets** — `.env`, `.env.local`, service-role keys
- **Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser** — not via NEXT_PUBLIC_*, not via Client Component imports
- **Never log sensitive data** — KYC document URLs, payment proof URLs, full tokens
- **Never trust client-side validation** as the security boundary
- **Never use `eval()` / `dangerouslySetInnerHTML`** with user-provided data
- **Never skip RLS** by using the service-role client where the SSR client would suffice
- **Never store auth tokens in `localStorage`** — Supabase SSR handles cookies for us
- **Never expose stack traces** from server actions to the UI — return error codes

## Input validation (every server action)

Pattern enforced by `.cursor/rules/server-actions.mdc`:

```typescript
"use server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const Schema = z.object({
  listingId: z.string().uuid(),
  requestedQty: z.number().positive().max(100000),
  notes: z.string().max(2000).optional(),
});

export async function createInquiry(input: unknown) {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) {
    return {
      data: null,
      error: "VALIDATION_ERROR",
      details: parsed.error.flatten(),
    };
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { data: null, error: "UNAUTHORIZED" };

  // RLS will enforce buyer_id = auth.uid() automatically
  const { data, error } = await sb
    .from("inquiries")
    .insert({ ...parsed.data, buyer_id: user.id })
    .select()
    .single();

  if (error) {
    console.error("[createInquiry]", error);
    return { data: null, error: "DB_ERROR" };
  }
  return { data, error: null };
}
```

## RLS policies

- Every table must have RLS enabled and explicit `for select`, `for insert`, `for update`, `for delete` policies
- Buyer / seller / admin separation modeled via `profiles.role`
- For cross-role tables (orders, payments, chat_rooms), policies reference both `buyer_id` and `seller_id`
- Verify after any policy change:

```powershell
npm run qa:verify-rls
```

Reference: `supabase/migrations/005_*.sql`, `010_*.sql`, `015_*.sql`, `018_*.sql`.

## Payment verification (project-specific)

- **Seller is the primary verifier** (migration 015); admin overrides only
- **No wallet SDK / on-chain calls** — buyer submits `tx_hash` text or uploads proof image
- Buyer can submit; seller-of-order or admin can update `payments.status`
- Every status change appends to `audit_logs` and the order's `timeline`

Smoke test: `npm run qa:payment-schedule` and `npm run qa:a7:gate`.

## File uploads (Supabase Storage)

```typescript
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 5 * 1024 * 1024;

if (!ALLOWED.includes(file.type)) {
  return { data: null, error: "FILE_TYPE_NOT_ALLOWED" };
}
if (file.size > MAX_BYTES) {
  return { data: null, error: "FILE_TOO_LARGE" };
}
```

Bucket policies must allow only the row owner (buyer/seller) to read their own uploads. Admin reads via service-role client only in `src/app/admin/**`.

## Auth (Supabase)

- Routes under `(auth)/` handle login/register/verify
- `src/proxy.ts` (Next 16 middleware) gates `/admin/**` by `profile.role IN ('admin','super_admin')`
- Cookie-based session via `@supabase/ssr` — never expose tokens to JS
- Password hashing handled by Supabase Auth — do not re-hash

Smoke test: `npm run qa:oauth` validates Google OAuth env config.

## Secrets management

```
✓ Committed:        .env.example  (placeholder values only)
✗ NOT committed:    .env, .env.local, .env.*.local
```

`.gitignore` already covers these. Verify before commit:

```powershell
git diff --cached | Select-String -Pattern "supabase|service_role|api_key|password|secret" -CaseSensitive:$false
```

## XSS

Server Components are escaped by default. The only places that render HTML are:

- `src/lib/contract/template.ts` — contract HTML from a controlled template (admin-edited fields, not user-typed HTML)
- AI chat messages — markdown rendered via `react-markdown` (no `rehype-raw` — confirmed safe)

Never introduce `dangerouslySetInnerHTML` with user input.

## Output sanitization in server actions

Never return raw stack traces:

```typescript
// BAD
return { data: null, error: err.message, stack: err.stack };

// GOOD
console.error("[feature]", err);
return { data: null, error: "INTERNAL_ERROR" };
```

The UI maps the error code to a translated user-facing message via next-intl.

## Pre-commit security checklist

```markdown
### Authentication
- [ ] Server actions check `auth.getUser()` before mutating
- [ ] Admin routes still gated in `src/proxy.ts`

### Authorization
- [ ] Every new table has RLS enabled in its migration
- [ ] `npm run qa:verify-rls` exit 0 after RLS changes

### Input
- [ ] Every server action validates input with zod
- [ ] File uploads check type + size

### Data
- [ ] No new logs print sensitive URLs / tokens
- [ ] `SUPABASE_SERVICE_ROLE_KEY` not referenced from any file under `src/components/**` or any `"use client"` file
- [ ] No env values committed to source

### Audit trail
- [ ] State machine transitions append to `orders.timeline`
- [ ] Admin actions append to `audit_logs`

### Dependencies
- [ ] npm audit reports no critical / high reachable in production runtime
```

## See also

- [references/security-checklist.md](../references/security-checklist.md) — generic web security checklist
- [`.cursor/rules/supabase.mdc`](../../rules/supabase.mdc) — client/server separation
- [`.cursor/rules/server-actions.mdc`](../../rules/server-actions.mdc) — `{ data, error }` pattern
- [`.cursor/rules/migrations.mdc`](../../rules/migrations.mdc) — RLS authoring rules
- `docs/ARCHITECTURE.md` §6 — security architecture

## Rationalizations

| Rationalization | Reality |
|---|---|
| "Internal flow, security can wait" | Internal tools get compromised. RLS is the only thing between roles. |
| "I'll add the zod schema later" | "Later" never comes. Validation is the boundary — write it now. |
| "Service role is fine here" | Service role bypasses RLS. Audit every use. Default to SSR client. |
| "The UI already validates this" | Client-side validation is UX, not security. Always re-validate in the action. |
| "It's just an MVP" | Payments + KYC + contracts are real. Production starts day one. |

## Red flags

- New server action with no zod schema
- New migration that adds a table without RLS policies
- A `"use client"` file importing from `src/lib/supabase/admin.ts`
- A console log printing a Supabase Storage signed URL
- A try/catch in a server action that swallows the error and returns `{ data: success }`
- A new admin endpoint that does not write to `audit_logs`
- A payment status change that does not append to `orders.timeline`

## Verification

After security-relevant changes:

- [ ] `npm run build` exit 0
- [ ] `npm run qa:verify-rls` exit 0 (if RLS changed)
- [ ] `npm run qa:payment-schedule` / `qa:a7` exit 0 (if payment / order changed)
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` reachable from any client bundle
- [ ] zod schema present at every server action boundary
- [ ] `audit_logs` row inserted for admin actions; `orders.timeline` appended for state transitions
- [ ] No secrets in `git diff --cached`
