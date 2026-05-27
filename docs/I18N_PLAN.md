# i18n Plan — Mada Graphite

Last updated: 2026-05-27.
Authoring rules: [`.cursor/rules/i18n.mdc`](../.cursor/rules/i18n.mdc).
Database column: `profiles.locale` (migration 028).

---

## 1. Goals & non-goals

### Goals (Phase 1, this branch `feature/dashboard-i18n`)

- Multi-language the **post-login dashboard** (everything under
  `src/app/(app)/**`) — and the Navbar / MobileNav components shared
  with public pages.
- Ship **English + Simplified Chinese (zh-CN)** today.
- Auto-detect locale from browser, allow user override in `/settings`,
  default to `en` when no match.
- Centralised, per-namespace dictionary files so translators can work
  one context at a time.

### Non-goals (deferred)

- **Public marketing pages** (`src/app/(public)/**`) — too much
  in-flight content work. Public pages stay English.
- **Contract HTML / PDF** — legal documents are English-only by business
  decision. See §4.
- **Email & SMS notifications** — English-only (SMS additionally must
  stay short).
- **Server-action error messages** — error codes maintained English.
- **AI Chat LLM output** — LLM already mirrors user-input language
  organically.
- **Traditional Chinese (zh-TW), Japanese, French, German** — planned;
  infrastructure ready, dictionaries pending.

---

## 2. Architecture

### 2.1 Stack

| Concern              | Choice                                                    |
|----------------------|-----------------------------------------------------------|
| Library              | [`next-intl`](https://next-intl.dev) (`4.x`)              |
| Routing              | **Cookie-based** — no `/[locale]/` URL prefix             |
| Server hook          | `getTranslations(namespace)` from `next-intl/server`      |
| Client hook          | `useTranslations(namespace)` from `next-intl`             |
| Plugin               | `createNextIntlPlugin('./src/i18n/request.ts')`           |
| Default              | `en`                                                      |
| Shipped              | `en`, `zh-CN`                                             |

### 2.2 Locale resolution

Implemented in `src/i18n/get-locale.ts`. Priority:

```
1. cookie  mg-locale         (user explicit, survives navigation)
2. DB      profiles.locale   (signed in, survives device change)
3. header  Accept-Language   (first-time visit fallback)
4. default 'en'
```

Cached per request via `cache()` so layout + page + components share a
single round-trip.

### 2.3 Files

```
src/i18n/
├─ config.ts                  // SUPPORTED_LOCALES, DEFAULT_LOCALE, normalisers
├─ get-locale.ts              // cookie → DB → header → default
├─ request.ts                 // next-intl plugin config (server)
├─ messages.ts                // NAMESPACES + loadMessages()
└─ messages/
   ├─ en/
   │  ├─ common.json          // buttons, generic labels, units
   │  ├─ nav.json             // navbar items, sidebar headings
   │  ├─ dashboard.json       // /dashboard
   │  ├─ settings.json        // /settings (incl. language selector)
   │  ├─ kyc.json             // /settings/kyc
   │  ├─ enums.json           // order/inquiry status, role, kyc level
   │  └─ errors.json          // client-originated UI errors only
   └─ zh-CN/                  // same shape
```

### 2.4 Key naming

- `namespace.section.key`, e.g. `dashboard.activeOrders.empty`.
- ICU variables for interpolation: `"welcomeNamed": "Welcome back, {name}"`.
- Plurals via ICU `plural`: required for English, collapse to `other` for
  Chinese.
- Status / role labels live in `enums.json` with backend enum value as the
  key: `order.status.contract_pending` ↔ DB value `contract_pending`.

---

## 3. Database

Migration 028:

```sql
alter table public.profiles
  add column if not exists locale text not null default 'en';

alter table public.profiles
  add constraint profiles_locale_check
  check (locale in ('en', 'zh-CN'));
```

When adding a new supported locale: drop the constraint, re-add it with
the new code included. The migration template (028) is idempotent.

---

## 4. Contract & notification exclusion

Three layers protect against accidental translation:

1. **File header** in `src/lib/contract/template.ts` and
   `src/components/order/ContractPreview.tsx` — large `DO NOT
   INTERNATIONALIZE` banner.
2. **Project rule** `.cursor/rules/i18n.mdc` — explicit forbid list.
3. **PR review** — any diff that adds `getTranslations()` or
   `useTranslations()` to `lib/contract/*`, `lib/email/*`, `actions/*`
   (for error messages), or the print PDF code path must be rejected.

The contract preview's UI **chrome that is also embedded in the PDF**
(signature pane labels, "Pending upload." placeholder, "Print / Save PDF"
button text) stays in English. The print window output is byte-identical
regardless of UI locale.

---

## 5. Settings UI

`/settings` now shows a Language section with a `<Select>` populated from
`SUPPORTED_LOCALES`. Changing the value calls `setLocaleFromString`
server action (`src/actions/profile.ts`) which:

1. Updates `profiles.locale`.
2. Writes the `mg-locale` cookie (1-year max-age).
3. `revalidatePath('/', 'layout')` so the new dictionary loads on the
   next render.

The selector reads the current value from `useLocale()` so the displayed
state always matches the resolved locale.

---

## 6. Status of pages (Phase 1)

| Page / component                                 | Status        |
|--------------------------------------------------|---------------|
| `src/app/(app)/layout.tsx`                       | ✅ Translated |
| `src/app/(app)/dashboard/page.tsx`               | ✅ Translated |
| `src/app/(app)/settings/page.tsx`                | ✅ Translated |
| `src/components/layout/Navbar.tsx`               | ✅ Auth chrome translated; public links English-only |
| `src/components/layout/MobileNav.tsx`            | ✅ Translated (public links passed via props) |
| `src/components/auth/LogoutButton.tsx`           | ✅ Translated |
| `src/components/settings/LanguageSelector.tsx`   | ✅ New, translated |
| `src/lib/notifications/counts.ts`                | ✅ Key-returning variant added (`describeOrderActionKey`) |
| `src/app/(app)/settings/kyc/page.tsx`            | ⏳ Pending (Phase 2) |
| `src/app/(app)/market/**`                        | ⏳ Pending (Phase 2) |
| `src/app/(app)/listings/**`                      | ⏳ Pending (Phase 2) |
| `src/app/(app)/inquiries/**`                     | ⏳ Pending (Phase 2) |
| `src/app/(app)/orders/**`                        | ⏳ Pending (Phase 2) |
| `src/app/(app)/messages/**`                      | ⏳ Pending (Phase 2) |
| `src/app/admin/**`                               | ⏳ Pending (Phase 3) |
| `src/components/order/*` (forms, tables, panes)  | ⏳ Pending (Phase 2) |
| `src/components/listing/*`                       | ⏳ Pending (Phase 2) |
| `src/components/kyc/*`                           | ⏳ Pending (Phase 2) |
| `src/components/messages/*`                      | ⏳ Pending (Phase 2) |
| `src/components/auth/CommercialProfileForm.tsx`  | ⏳ Pending (Phase 2) |
| Contract template + PDF output                   | 🚫 Locked English |
| Email / SMS / audit log strings                  | 🚫 Locked English |
| Public pages                                     | 🚫 Deferred |

---

## 7. Phase 2 plan (remaining dashboard pages)

Estimated 4–6 working days. Per page:

1. Inventory English strings.
2. Add keys under the appropriate namespace (extend or create).
3. Replace literals with `t(...)` or `tEnums(...)`.
4. Translate to `zh-CN`.
5. Run `npm run build` + manual walkthrough in both locales.

Suggested order (smallest to biggest):

1. `kyc.json` + `/settings/kyc` + `src/components/kyc/*`
2. `messages.json` + `/messages` + `/messages/[userId]` + `src/components/messages/*`
3. `listings.json` + `/listings`, `/listings/new`, `/listings/[id]/edit` + `src/components/listing/*`
4. `market.json` + `/market`, `/market/[id]` + `src/components/market/MarketListingCard.tsx`
5. `inquiries.json` + `/inquiries`, `/inquiries/[id]`
6. `orders.json` + `/orders`, `/orders/[id]` (this is the biggest one — many sub-components)

Each batch can be committed independently and the feature flag (the
locale selector) makes it safe to ship half-translated dictionaries —
missing keys fall back to English per `loadMessages()`.

---

## 8. Adding a new locale (future)

```
1. Drop src/i18n/messages/<code>/*.json (translate every namespace).
2. Add <code> to SUPPORTED_LOCALES in src/i18n/config.ts.
3. Update normaliseLocaleTag() if Accept-Language → <code> mapping is
   ambiguous (e.g. zh-TW vs zh-CN — handled today by collapsing both
   to zh-CN; add a zh-Hant branch when zh-TW dictionary ships).
4. Write migration NNN_profile_locale_add_<code>.sql that drops +
   re-adds the profiles_locale_check constraint.
5. Add option label settings.languageSection.options.<code> for every
   existing locale.
6. Bump the table in .cursor/rules/i18n.mdc.
```

---

## 9. QA checklist (run before merging)

```powershell
npm run build                          # exit 0
npm run db:migrate:status              # 028 applied
node scripts/verify-schema.mjs         # locale column present (if script extended)
npm run dev                            # then:
#   visit /dashboard with mg-locale=en   → English
#   visit /dashboard with mg-locale=zh-CN → Simplified Chinese
#   open /settings → change language → toast + locale switches
#   open /orders/<id> contract preview → contract body still English
npm run qa:check-dev                   # exit 0
```
