# Spec 07 --- Transaction Persistence

## 1. Status

**Status:** Draft --- Source of Truth\
**Scope:** Database persistence for imported JCB statement transactions\
**Depends on:** Spec 01--06\
**Next planned scope:** Spec 08 --- Historical Period Navigation

## 2. Purpose

The application currently keeps imported `Transaction[]` in client-side
React state. Spec 07 introduces persistent server-side storage so
imported JCB statement data survives reloads and multiple statement
periods can coexist.

Primary scenario: 1. Import a July JCB statement. 2. Persist July. 3.
Import an August JCB statement. 4. Add August without deleting July. 5.
Reload. 6. Both periods still exist and can be loaded from the database.

Historical period-selection/comparison UI is deferred to Spec 08.

## 3. Goals

Spec 07 MUST: - introduce PostgreSQL persistence; - store each
successful CSV import as an import batch; - store all transactions
belonging to that batch; - preserve old batches when a new batch is
imported; - prevent accidental duplicate statement imports; - persist
writes atomically; - restore persisted transactions after reload; -
preserve existing Dashboard and Transaction Explorer behavior; - keep DB
credentials/access server-side; - preserve the existing OpenAI privacy
boundary; - keep the current browser `localStorage` category cache
unchanged.

## 4. Non-Goals

Spec 07 MUST NOT implement historical period selector, monthly
comparison, category-chart navigation, DB-backed merchant category
cache, DB persistence of later manual corrections, custom categories,
auth, multi-user support, MyJCB automation/scraping, Discord, AI
spending summaries, PWA, transaction/import deletion or replacement, CSV
export, pagination, or server-side Dashboard/Explorer aggregation.

## 5. Technology Decisions

-   Database: **Neon PostgreSQL**
-   Hosting/server: existing **Vercel + Next.js**
-   ORM: **Drizzle ORM**
-   Migrations: **Drizzle Kit**
-   DB access: server-side only.

``` text
Browser
  ↓
Next.js API
  ↓
Neon PostgreSQL
```

No DB secret may be exposed to browser code.

## 6. Persistence Model

Persistence is append-only at the import-batch level. A successful new
import MUST NOT delete, replace, or overwrite older batches.

``` text
Import Batch A — 2026-07-16 → 2026-08-15
└─ transactions...

Import Batch B — 2026-08-16 → 2026-09-15
└─ transactions...
```

## 7. Database Schema

### 7.1 `import_batches`

Fields: - `id`: server-generated primary key - `period_start`: date -
`period_end`: date - `fingerprint`: canonical SHA-256 fingerprint -
`transaction_count`: persisted child count - `imported_at`:
server/database-generated timestamp

Constraints: - `fingerprint` UNIQUE - `(period_start, period_end)`
UNIQUE - `period_start <= period_end`

### 7.2 `transactions`

Fields: - `id`: server-generated DB primary key - `import_batch_id`: FK
→ `import_batches.id` - `source_transaction_id`: optional existing
parser/client identifier - `date` - `merchant_raw` -
`merchant_normalized` - `amount` - `category` - `category_source` -
`description` nullable - `approval_number` nullable - `created_at`

Requirements: - every transaction belongs to exactly one batch; - DB
identity does not rely on client-supplied IDs; - amount sign/value is
preserved; - calendar dates must not timezone-shift; - category is one
of the existing fixed nine values; - categorySource is
`ai | cache | manual`.

Fixed categories remain: `convenience_store`, `supermarket`,
`vending_machine`, `restaurant`, `subscription`, `shopping`,
`transportation`, `entertainment`, `other`.

## 8. JCB Statement Parsing Change

The parser must additionally expose the CSV `対象期間` metadata:

``` ts
type ParsedJcbStatement = {
  periodStart: string;
  periodEnd: string;
  transactions: ParsedTransaction[];
};
```

Example: `"対象期間","2026年7月16日～2026年8月15日"` becomes
`2026-07-16` / `2026-08-15`.

Missing/malformed required period metadata fails safely. The persistence
layer MUST NOT invent the period from min/max transaction dates.
Existing settled-section parsing remains unchanged.

## 9. Import Flow

``` text
JCB CSV
 ↓
Browser parser
 ↓
ParsedJcbStatement
 ↓
existing Category Cache / OpenAI classification
 ↓
Transaction[]
 ↓
POST /api/imports
 ↓
server validation
 ↓
canonical fingerprint
 ↓
duplicate check
 ↓
DB transaction
 ├─ INSERT import_batches
 └─ INSERT transactions
 ↓
COMMIT
 ↓
client success / Context
```

A DB persistence failure is not a successful import.

## 10. Atomicity

Batch and child writes MUST be one DB transaction. Any required insert
failure rolls back the complete new import. No partial batch/transaction
set may remain. Older committed batches remain untouched.

## 11. Duplicate Import Policy

Duplicate prevention is batch-level, not individual-purchase
deduplication.

For Spec 07: - exact `(period_start, period_end)` duplicates are
rejected; - canonical fingerprint duplicates are rejected; - no
automatic merge/replace occurs; - legitimate identical
date+merchant+amount rows inside one statement are preserved.

Fingerprint: - generated server-side; - SHA-256; - deterministic
canonical serialization; - includes normalized period and meaningful
ordered transaction content; - does not depend on filename, browser file
metadata, raw CSV bytes, or irrelevant CSV export timestamps.

DB UNIQUE constraints are the final concurrency-safe guard.

Duplicate response: - HTTP `409` - code `IMPORT_ALREADY_EXISTS` - no new
batch or transactions.

## 12. API Design

### `POST /api/imports`

Persists one fully parsed/classified statement. Server treats request as
untrusted and validates period, transaction shape/date/range, finite
amount, fixed category, categorySource, nullable fields, and reasonable
size limits.

Success: `201 Created` with persisted batch metadata.

Errors: - `400 INVALID_REQUEST` - `409 IMPORT_ALREADY_EXISTS` -
`500 IMPORT_FAILED`

Raw DB errors must never be returned.

### `GET /api/imports`

Returns persisted batch metadata, ordered by `periodEnd DESC`, then
`importedAt DESC`. Foundation for Spec 08; no period-selector UI in Spec
07.

### `GET /api/transactions`

-   no query → all persisted transactions;
-   `?batchId=<id>` → that batch only.

Unknown valid batch ID returns an empty collection. Malformed supported
query parameters return safe `400`. Returned data must map to the
existing client `Transaction` shape.

## 13. Application Startup / Reload

On application load:

``` text
GET /api/transactions
 ↓
Transaction[]
 ↓
Transaction Context
 ↓
Dashboard / Explorer
```

After July + August imports, full reload MUST preserve/recover both.
PostgreSQL is the persistence Source of Truth; React Context remains
client UI state.

## 14. Existing Category Cache

Keep the existing `localStorage` merchantNormalized → Category cache.
Cache hits still avoid AI; misses use the existing `/api/classify`. Do
not migrate this cache to PostgreSQL in Spec 07.

## 15. Manual Category Correction

Existing browser/session correction behavior remains. The category at
import time is persisted, but Spec 07 adds no DB update endpoint for
later corrections. Persistent correction semantics are deferred. This
limitation must be documented.

## 16. Privacy and Security

-   DB secrets are server-only and never `NEXT_PUBLIC_*`.
-   No DB credentials in client JS, payloads, responses, source, or
    committed env files.
-   Existing `/api/classify` privacy rules remain unchanged.
-   Persistence MUST NOT cause amounts, dates, approval numbers,
    descriptions, raw CSV, or DB records to be sent to OpenAI.
-   API errors expose stable safe codes, not SQL/stack/credential
    details.

## 17. Failure Behavior

-   DB unavailable → import fails safely; no partial write; retry
    possible.
-   Duplicate → `409 IMPORT_ALREADY_EXISTS`; no write.
-   Invalid request → `400 INVALID_REQUEST`; no write.
-   Read failure → distinguish from legitimate empty DB; do not
    fabricate successful empty history or destroy persisted data.

## 18. UI Scope

Only minimal persistence-related UI changes are allowed. Import must
distinguish parsing/classification failure, duplicate, persistence
failure, and success. No Dashboard/Explorer redesign and no historical
period selector.

## 19. Data Migration

No migration of already-open transient pre-Spec-07 Context data is
required. No migration of localStorage category cache is required. Use
fictional/anonymized data for development/tests.

## 20. Required Verification

Run:

``` bash
npm test
npm run lint
npx tsc --noEmit
npm run build
git diff --check
```

Database-backed verification must be reported separately. No real OpenAI
request is required for tests.

## 21. Acceptance Criteria

### A. Infrastructure

-   **AC01** Neon PostgreSQL is used.
-   **AC02** Drizzle ORM is used.
-   **AC03** Drizzle Kit manages migrations.
-   **AC04** DB access is server-side only.
-   **AC05** No DB credential uses `NEXT_PUBLIC_*`.
-   **AC06** No DB secret is committed.
-   **AC07** Server can connect using environment configuration.
-   **AC08** Schema is reproducibly creatable through migrations.

### B. Import batches

-   **AC09** `import_batches` exists.
-   **AC10** Batch ID is server-generated.
-   **AC11** `period_start` is stored.
-   **AC12** `period_end` is stored.
-   **AC13** canonical fingerprint is stored.
-   **AC14** transaction count is stored.
-   **AC15** imported timestamp is server/database-generated.
-   **AC16** fingerprint is UNIQUE.
-   **AC17** `(period_start, period_end)` is UNIQUE.
-   **AC18** new imports do not delete old batches.

### C. Transactions

-   **AC19** `transactions` exists.
-   **AC20** DB transaction ID is server-generated.
-   **AC21** every transaction belongs to one batch.
-   **AC22** relationship is FK-enforced.
-   **AC23** date persists.
-   **AC24** merchantRaw persists.
-   **AC25** merchantNormalized persists.
-   **AC26** amount/sign persists unchanged.
-   **AC27** category persists.
-   **AC28** categorySource persists.
-   **AC29** description remains nullable.
-   **AC30** approvalNumber remains nullable.
-   **AC31** only nine fixed categories accepted.
-   **AC32** only ai/cache/manual source accepted.
-   **AC33** dates do not timezone-shift.
-   **AC34** legitimate identical date+merchant+amount rows are not
    collapsed.

### D. Statement period

-   **AC35** `対象期間` is parsed.
-   **AC36** Japanese dates normalize to YYYY-MM-DD.
-   **AC37** statement result contains periodStart.
-   **AC38** statement result contains periodEnd.
-   **AC39** statement result contains parsed transactions.
-   **AC40** Spec 02 settled-section behavior is unchanged.
-   **AC41** missing period fails safely.
-   **AC42** malformed period fails safely.
-   **AC43** persistence does not infer period from transaction min/max.

### E. Import validation

-   **AC44** POST `/api/imports` exists.
-   **AC45** request body is untrusted.
-   **AC46** invalid top-level structure rejected.
-   **AC47** malformed periodStart rejected.
-   **AC48** malformed periodEnd rejected.
-   **AC49** periodStart \> periodEnd rejected.
-   **AC50** malformed transaction array rejected.
-   **AC51** malformed transaction date rejected.
-   **AC52** transaction outside statement period rejected.
-   **AC53** invalid/non-finite amount rejected.
-   **AC54** unknown category rejected.
-   **AC55** unknown categorySource rejected.
-   **AC56** invalid nullable field types rejected.
-   **AC57** reasonable request/collection limits enforced.
-   **AC58** invalid request returns 400.
-   **AC59** invalid request writes no batch.
-   **AC60** invalid request writes no transactions.

### F. Fingerprint / duplicates

-   **AC61** fingerprint generated server-side.
-   **AC62** SHA-256 used.
-   **AC63** canonical serialization deterministic.
-   **AC64** statement period participates.
-   **AC65** meaningful transaction content participates.
-   **AC66** filename does not affect fingerprint.
-   **AC67** browser file metadata does not affect fingerprint.
-   **AC68** irrelevant export timestamp does not affect fingerprint.
-   **AC69** same logical statement under another filename is duplicate.
-   **AC70** exact persisted period re-import is rejected.
-   **AC71** duplicate returns 409.
-   **AC72** duplicate code is `IMPORT_ALREADY_EXISTS`.
-   **AC73** duplicate creates zero batches.
-   **AC74** duplicate creates zero transactions.
-   **AC75** DB uniqueness backs duplicate prevention.
-   **AC76** no individual dedup solely by date+merchant+amount.

### G. Atomic persistence

-   **AC77** successful import creates exactly one batch.
-   **AC78** every submitted transaction is persisted exactly once in
    that batch.
-   **AC79** transaction_count equals persisted child count.
-   **AC80** batch + child inserts are atomic.
-   **AC81** child persistence failure rolls back batch.
-   **AC82** failure leaves no partial child set.
-   **AC83** rollback does not modify older batches.
-   **AC84** client success occurs only after DB commit.
-   **AC85** successful import returns 201.
-   **AC86** success contains persisted batch metadata.
-   **AC87** unexpected DB failure returns safe 500 without internals.

### H. Multiple periods

-   **AC88** July statement can persist.
-   **AC89** different August statement can subsequently persist.
-   **AC90** August does not delete July.
-   **AC91** both batches coexist.
-   **AC92** transactions from both batches coexist.
-   **AC93** browser reload deletes neither batch.
-   **AC94** both batches' transactions can be recovered after reload.

### I. Read APIs

-   **AC95** GET `/api/imports` exists.
-   **AC96** it returns persisted batch metadata.
-   **AC97** batches use deterministic latest-period-first ordering.
-   **AC98** GET `/api/transactions` exists.
-   **AC99** unfiltered read returns all persisted transactions.
-   **AC100** transaction ordering is deterministic.
-   **AC101** batchId filtering works.
-   **AC102** unknown valid batchId returns empty collection.
-   **AC103** malformed supported query returns safe 400.
-   **AC104** read APIs expose no DB secrets/raw SQL errors.

### J. Reload / Context

-   **AC105** persisted transactions load on startup/reload.
-   **AC106** DB records map to existing client Transaction shape.
-   **AC107** Transaction Context remains existing UI state mechanism.
-   **AC108** Dashboard renders restored transactions.
-   **AC109** Explorer renders restored transactions.
-   **AC110** read failure differs from legitimate empty DB.
-   **AC111** read failure does not delete/overwrite persisted data.
-   **AC112** reload no longer erases successfully persisted history.

### K. Existing categories

-   **AC113** localStorage category cache remains used.
-   **AC114** cache hits still avoid unnecessary AI.
-   **AC115** cache misses still use `/api/classify`.
-   **AC116** category cache is not migrated to PostgreSQL.
-   **AC117** category at import time persists with transaction.
-   **AC118** no DB-backed correction endpoint added.
-   **AC119** existing client manual correction is not intentionally
    removed.
-   **AC120** post-import correction persistence limitation is
    documented.

### L. Privacy / regression

-   **AC121** `/api/classify` privacy boundary remains unchanged.
-   **AC122** persistence sends no amounts to OpenAI.
-   **AC123** persistence sends no dates to OpenAI.
-   **AC124** persistence sends no approval numbers to OpenAI.
-   **AC125** persistence sends no descriptions to OpenAI.
-   **AC126** persistence sends no raw CSV to OpenAI.
-   **AC127** DB connection info never appears browser-side.
-   **AC128** Dashboard total semantics unchanged.
-   **AC129** category aggregation unchanged.
-   **AC130** daily aggregation/zero filling unchanged.
-   **AC131** Daily Spending horizontal scroll unchanged.
-   **AC132** Explorer filters unchanged.
-   **AC133** category taxonomy unchanged.
-   **AC134** no spending judgment/浪費 concept introduced.

### M. Error UX

-   **AC135** duplicate gives clear safe Japanese already-imported
    message.
-   **AC136** DB write failure gives safe retryable Japanese error.
-   **AC137** DB errors expose no SQL/stack/credentials.
-   **AC138** failed persistence does not navigate as success.
-   **AC139** successful persistence follows existing success navigation
    unless minimally changed and documented.
-   **AC140** transient failed writes can be retried when nothing
    committed.

### N. Scope control

-   **AC141** no historical period selector.
-   **AC142** no monthly comparison UI.
-   **AC143** no auth.
-   **AC144** no multi-user model.
-   **AC145** no MyJCB automation/scraping.
-   **AC146** no Discord feature.
-   **AC147** no AI spending summary.
-   **AC148** no custom categories.
-   **AC149** no import deletion/replacement UI/API.
-   **AC150** no unnecessary dependency beyond approved DB/ORM/migration
    stack.

## 22. Manual Verification

Use fictional/non-sensitive data.

A. Empty DB → import July → one batch and expected rows →
Dashboard/Explorer render.\
B. Full reload → July restored.\
C. Import different August → July remains + August added → two batches →
reload → both remain.\
D. Re-import July → duplicate message → no third batch/no duplicate
rows.\
E. Confirm category-cache behavior, `/api/classify` privacy, no browser
DB credentials, Dashboard charts, Daily Spending horizontal scroll, and
Explorer filters.

## 23. Implementation Report

Codex must report: 1. Summary 2. Files created/modified 3. Dependencies
4. Environment variables 5. Migration/schema 6. API routes 7.
Fingerprint canonicalization 8. Duplicate handling 9.
Transaction/rollback behavior 10. Startup hydration 11.
Automated/integration/build results 12. Manual checklist 13. AC01--AC150
status 14. Deviations 15. Known limitations

Never mark an AC PASS unless actually verified.

## 24. Planning Gate

Before implementation Codex MUST: 1. Read `AGENTS.md`,
`specs/PROJECT_SPEC.md`, relevant Spec 01--06, and this Spec. 2. Inspect
parser, classification, category cache, Transaction Context, Dashboard,
Explorer, API conventions, package config, and tests. 3. Read the
current local Next.js docs required by `AGENTS.md`. 4. Produce a plan
only. 5. Identify exact expected files, dependencies, migrations,
environment variables, DB-test strategy, risks/conflicts. 6. Use only
fictional/anonymized DB test data. 7. Do not edit files. 8. Do not
install dependencies. 9. Do not run migrations. 10. Do not modify
Vercel/Neon configuration. 11. Do not commit. 12. Do not push. 13. Stop
after the plan and wait for approval.

## 25. Definition of Done

Spec 07 is complete only when schema migration succeeds, server
persistence works, July and August test batches coexist, duplicate
re-import is rejected, writes are atomic, reload restores persisted
transactions, Dashboard/Explorer and privacy boundaries regress cleanly,
required automated/manual checks pass, AC01--AC150 are reviewed,
deviations are documented, and implementation is explicitly approved
before commit/push.
