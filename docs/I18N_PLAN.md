# i18n Plan — Mada Graphite

Last updated: 2026-05-28.
Authoring rules: [`.cursor/rules/i18n.mdc`](../.cursor/rules/i18n.mdc).
Database column: `profiles.locale` (migration 028).

---

## 1. Goals & non-goals

### Goals (Phase 1 + Phase 2 — **merged to `main` 2026-05-27**; public marketing update 2026-05-28)

- Multi-language the **post-login dashboard** (everything under
  `src/app/(app)/**`) — and the Navbar / MobileNav components shared
  with public pages.
- Multi-language the core **public marketing pages**: `/`, `/about`,
  `/products`, `/sustainability`, and `/geopolitics`.
- Ship **English + Simplified Chinese (zh-CN)**.
- Auto-detect locale from browser, allow user override in `/settings`,
  default to `en` when no match.
- Centralised, per-namespace dictionary files so translators can work
  one context at a time.

### Non-goals (deferred)

- **Remaining public pages** (`/news/**` and `/chat`) — deferred until
  content/data model stabilises.
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
   │  ├─ nav.json             // navbar items, sidebar headings, locale switcher
   │  ├─ home.json            // homepage sections (Hero, KPIs, SupplyMap, …)
   │  ├─ about.json           // /about
   │  ├─ products.json        // /products
   │  ├─ sustainability.json  // /sustainability
   │  ├─ geopolitics.json     // /geopolitics
   │  ├─ footer.json          // Footer chrome
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

`/settings` shows a Language section with a `<Select>` populated from
`SUPPORTED_LOCALES`. Two code paths:

| 情境 | 元件 | Server action | 行為 |
|---|---|---|---|
| 已登入 | `/settings` → `<LanguageSelector />` | `setLocaleFromString` → `updateProfileLocale` | 寫入 `profiles.locale` + `mg-locale` cookie |
| 訪客 | Navbar / MobileNav → `<LocaleSwitcher />` | `setLocaleCookieOnly` | 僅寫 `mg-locale` cookie（不碰 DB） |

Both paths call `revalidatePath('/', 'layout')` so the new dictionary loads on
the next render.

The selector reads the current value from `useLocale()` so the displayed
state always matches the resolved locale.

---

## 6. Status of pages (2026-05-28)

| Page / component                                 | Status        |
|--------------------------------------------------|---------------|
| `src/app/(app)/layout.tsx`                       | ✅ Translated |
| `src/app/(app)/dashboard/page.tsx`               | ✅ Translated |
| `src/app/(app)/settings/page.tsx`                | ✅ Translated |
| `src/app/(app)/settings/kyc/page.tsx`            | ✅ Translated |
| `src/app/(app)/market/**`                        | ✅ Translated |
| `src/app/(app)/listings/**`                      | ✅ Translated |
| `src/app/(app)/inquiries/**`                     | ✅ Translated |
| `src/app/(app)/orders/**`                        | ✅ Translated (detail tabs + phase actions) |
| `src/app/(app)/messages/**`                      | ✅ Translated |
| `src/app/(public)/page.tsx`                      | ✅ Translated |
| `src/app/(public)/about/page.tsx`                | ✅ Translated |
| `src/app/(public)/products/page.tsx`             | ✅ Translated |
| `src/app/(public)/sustainability/page.tsx`       | ✅ Translated |
| `src/app/(public)/geopolitics/page.tsx`          | ✅ Translated |
| `src/components/home/*`                          | ✅ Translated |
| `src/components/layout/Navbar.tsx`               | ✅ Translated (auth + public links + locale switcher) |
| `src/components/layout/MobileNav.tsx`            | ✅ Translated (auth + public links + locale switcher) |
| `src/components/layout/Footer.tsx`               | ✅ Translated |
| `src/components/layout/NavSearchTrigger.tsx`     | ✅ Translated |
| `src/components/auth/LogoutButton.tsx`           | ✅ Translated |
| `src/components/auth/CommercialProfileForm.tsx`  | ✅ Translated |
| `src/components/profile/AvatarUploader.tsx`      | ✅ Translated |
| `src/components/settings/LanguageSelector.tsx`   | ✅ Translated |
| `src/components/kyc/*`                           | ✅ Translated |
| `src/components/messages/*`                      | ✅ Translated |
| `src/components/listing/*`                       | ✅ Translated |
| `src/components/market/MarketListingCard.tsx`    | ✅ Translated |
| `src/components/order/*` (major UI)              | ✅ Mostly translated — see §7 gaps |
| `src/lib/notifications/counts.ts`                | ✅ Key-returning variant (`describeOrderActionKey`) |
| `src/app/admin/**`                               | ⏳ Phase 3 |
| Contract template + PDF **body**                 | 🚫 Locked English |
| `ContractPreview` download/print chrome          | 🚫 Locked English (PDF export) |
| Email / SMS / audit log strings                  | 🚫 Locked English |
| `src/app/(public)/news/**`                       | ⏳ Deferred (DB content model) |
| `src/app/(public)/chat/**`                       | ⏳ Deferred |

---

## 7. Phase 2 completion & remaining gaps

**Completed 2026-05-27** (7 commits on `feature/dashboard-i18n`, fast-forward merged to `main`):

1. Foundation — next-intl plugin, `get-locale.ts`, migration 028, LanguageSelector
2. KYC + Messages
3. Listings
4. Market + Inquiries
5. Orders (list, detail tabs, progress bar, phase actions, contract approve, shipment form, …)
6. Shared profile forms + nav search
7. Fix `<strong>` in translation strings causing `FORMATTING_ERROR`

**Known partial gaps** (UI chrome still English; safe to ship):

| Component | Examples still English |
|---|---|
| `PaymentScheduleTable.tsx` | Column headers, `Submit Payment` / `Pay Early` / `Resubmit Payment`, review dialog |
| `ContractPreview.tsx` | `Download signed contract`, `Print / Save PDF` (intentional for PDF) |
| `ContractDraftForm.tsx` / `PaymentScheduleBuilder.tsx` | Complex seller contract builder labels |
| `PaymentScheduleTable` schedule enums | Uses `CATEGORY_LABEL` / `MILESTONE_LABEL` from `payment-schedule.ts` (English constants) |

**Completed 2026-05-28**:

1. Public marketing foundation — `home`, `about`, `products`,
   `sustainability`, `geopolitics`, and `footer` namespaces
2. Public Navbar / MobileNav link labels + guest locale switcher
3. Homepage component tree (`src/components/home/*`)
4. Public marketing pages: `/`, `/about`, `/products`, `/sustainability`,
   `/geopolitics`

**Phase 3 (deferred):**

- Remaining public pages: `/news/**` chrome + DB-backed translated content model, `/chat`
- Admin console `/admin/**`
- Additional locales: `zh-TW`, `ja`, `fr`, `de`

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

## 9. QA checklist (run after i18n changes)

```powershell
npm run build                          # exit 0
npm run db:migrate:status              # 028 applied (profiles.locale)
#   visit /dashboard with mg-locale=en   → English
#   visit /dashboard with mg-locale=zh-CN → Simplified Chinese
#   open /settings → change language → toast + locale switches
#   visit /, /about, /products, /sustainability, /geopolitics with
#   mg-locale=en and mg-locale=zh-CN
#   open /orders/<id>?tab=contract → contract HTML body still English
npm run qa:check-dev                   # exit 0 (tail log or clear stale entries first)
```

> **Merged to `main`**: 2026-05-27. Re-run the walkthrough above after any i18n dictionary or component change.
