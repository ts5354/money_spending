# Spec 09 — Historical Period Navigation

**Status:** CLOSED
**Parent:** `specs/PROJECT_SPEC.md`
**Depends on:** Spec 01–08
**Primary goal:** Allow the authorized user to switch Dashboard and Transaction Explorer views between each persisted JCB statement period and all persisted periods.

---

## 1. Purpose

Spec 07 made multiple JCB statement periods persistent. Spec 09 adds the smallest UI and client-state layer needed to navigate those saved periods.

The Dashboard receives a period selector. Its selection is shared with `/transactions` for the current browser session. The selected period controls the transaction set shown and aggregated by both pages.

This Spec does not add comparison, prediction, budgeting, or new analysis.

---

## 2. Frozen Product Decisions

### 2.1 Available selections

The Dashboard period selector contains:

- every persisted JCB statement period returned by `GET /api/imports`;
- one explicit `全期間` option.

A period label uses:

```text
YYYY/MM/DD〜YYYY/MM/DD
```

### 2.2 Default selection

When one or more import batches exist, initial selection is the latest **statement period**, not the most recently imported batch.

Ordering is:

1. `periodEnd DESC`;
2. `periodStart DESC`;
3. a stable identifier such as `id` only as a deterministic tie-breaker.

`importedAt` is not the primary meaning of latest period.

### 2.3 Selection lifetime

Selection is in-memory session state only. It MUST NOT be persisted in:

- `localStorage`;
- `sessionStorage`;
- cookies;
- the database;
- URL path or query parameters.

Full reload initializes the latest statement period again. Client-side navigation between `/` and `/transactions` preserves the selection through the existing provider.

### 2.4 Import behavior

- Import while a valid batch is selected: preserve that selection.
- Import while `全期間` is selected: preserve `全期間`.
- First import while no batches exist and selection is `null`: select the newly imported batch.
- Reload after import: apply the normal latest-period rule.
- Existing successful-import navigation to `/` remains unchanged.

### 2.5 Data retrieval

Use the existing protected APIs:

```text
Period list      GET /api/imports
Specific period GET /api/transactions?batchId=<UUID>
All periods     GET /api/transactions
```

All-period retrieval MUST use the queryless endpoint once. It MUST NOT issue one transaction request per import batch or reconstruct all periods by concatenating batch requests.

No new API Route or Server Action is introduced.

---

## 3. Current Baseline to Preserve

- Brand: `浪費対策ナビ`.
- `Transaction` is the public application transaction type and has no `importBatchId`.
- `GET /api/imports` returns persisted `ImportBatch[]` metadata.
- `GET /api/transactions` returns all persisted transactions.
- `GET /api/transactions?batchId=<UUID>` returns one batch's transactions.
- `TransactionProvider` is the shared in-memory UI state boundary below `ClerkProvider`.
- `DashboardContent` performs all Dashboard aggregation through `aggregateDashboard()`.
- `TransactionExplorer` applies its existing category/from/to filters and stable newest-first sorting.
- CSV import parses in the browser, classifies merchants, persists through `POST /api/imports`, updates client state, and navigates to `/`.
- Spec 08 page and API authorization remains the security boundary.

---

## 4. State Model

```ts
type PeriodSelection =
  | { kind: "all" }
  | { kind: "batch"; batchId: string };
```

`null` represents only:

- initialization before persisted imports are known; or
- a valid empty state where no import batch exists.

`null` MUST NOT represent all periods.

The existing Transaction Context remains the only shared Transaction state mechanism. Its state is divided conceptually into:

1. **Canonical session data**
   - persisted import metadata;
   - transaction responses cached in memory by request scope;
   - one all-period response when loaded;
   - specific batch responses when loaded.
2. **Selection state**
   - `selectedPeriod`.
3. **Derived display view**
   - `selectedTransactions`, resolved from canonical data and `selectedPeriod`.

The meaning of the existing `transactions` contract MUST NOT be silently changed for existing consumers. A clearly named `selectedTransactions` value should be exposed for Dashboard and Transaction Explorer. Canonical data and the derived selected view are not two independent sources of truth.

Selection and caches are cleared together with Transaction state when the user signs out.

---

## 5. Client Data Lifecycle

### 5.1 Authorized initialization

```text
Authorized TransactionProvider mount
  ↓
GET /api/imports
  ↓
No imports?
  ├─ yes → selectedPeriod = null; selectedTransactions = []
  └─ no  → determine latest period
              ↓
        selectedPeriod = latest batch
              ↓
GET /api/transactions?batchId=<latest-id>
              ↓
        selectedTransactions
```

An API error is not an empty database. It uses the existing read-error/retry behavior.

### 5.2 Selecting a specific period

```text
Select batch
  ↓
Use in-memory batch response if already loaded
  or
GET /api/transactions?batchId=<UUID>
  ↓
selectedTransactions
```

### 5.3 Selecting all periods

```text
Select 全期間
  ↓
Use in-memory all-period response if already loaded
  or
GET /api/transactions
  ↓
selectedTransactions
```

Exactly one queryless transaction request is sufficient for an all-period load.

### 5.4 Request concurrency

If selection changes while a request is pending, an older response MUST NOT overwrite the newer selected view. Use an active-request version or equivalent cancellation-safe approach.

### 5.5 Retry

Retry reloads the required import/transaction state without treating authorization or network failure as an empty result.

---

## 6. Dashboard Behavior

Place a compact controlled period selector near the top of the existing Dashboard, without redesigning the page.

```text
selectedPeriod
  ↓
selectedTransactions
  ↓
DashboardContent
  ↓
aggregateDashboard()
  ├─ Total Spending
  ├─ Category Spending
  ├─ Category Proportion
  └─ Daily Spending
```

All four outputs MUST use the same selected transaction array. Existing aggregation rules, signed amounts, date semantics, zero-day filling, chart behavior, and formatters remain unchanged.

With no imports, preserve the existing Dashboard empty state. A meaningless active selector need not be shown.

---

## 7. Transaction Explorer Behavior

The period selection is a scope above the existing Explorer filters:

```text
selectedPeriod
  ↓
selectedTransactions
  ↓
filterTransactions()
  ├─ category
  ├─ from
  └─ to
  ↓
existing newest-first stable sorting
```

The period selection MUST NOT be added to the existing `TransactionFilters` object. Existing inclusive date semantics, AND semantics, validation, sorting, input immutability, and Transaction object immutability remain unchanged.

The Transactions page may show a concise read-only indication of the active statement scope, but it does not require a second selector.

---

## 8. Import Integration

On successful `POST /api/imports`, the client already receives:

```ts
{
  batch: ImportBatch;
  transactions: Transaction[];
}
```

The Context update must register both values so the new period immediately appears in the selector and the returned Transaction array is available without redundant fetching.

The update applies these rules atomically in client state:

- add the new batch to canonical period metadata;
- cache its returned transactions under that batch ID;
- invalidate or update a previously cached all-period response so `全期間` includes the new import;
- preserve an existing valid batch selection;
- preserve `all` selection;
- select the new batch only when this is the first import and prior selection is `null`;
- continue navigating to `/` after success.

No existing period is deleted, replaced, or deduplicated.

---

## 9. Invalid and Edge States

- **No imports:** `selectedPeriod = null`; both pages show existing empty states.
- **One period:** select it by default; both it and `全期間` are valid choices.
- **Multiple periods:** order by the frozen latest-period rule.
- **All periods:** fetch once through queryless `GET /api/transactions`.
- **Unknown valid batch response:** an empty array is a valid API response and must not crash the UI.
- **Stale selection:** if its batch is absent from the current import list, fall back to the latest valid batch.
- **Stale selection with no imports:** fall back to `null`.
- **Request failure:** display read error and retry, not an empty state.
- **Rapid changes:** stale responses cannot replace the current selection.
- **Sign-out:** clear period list, selection, transactions, and in-memory request caches.
- **Manual category correction:** continue updating the active in-memory Transaction data and existing Category Cache according to Spec 04/07; do not add DB persistence.
- **Duplicate import:** existing 409 behavior remains unchanged and must not mutate period state.

---

## 10. Security and Privacy

Spec 08 remains unchanged:

- protected pages: `/`, `/import`, `/transactions`;
- protected APIs: `POST /api/classify`, `GET/POST /api/imports`, `GET /api/transactions`;
- unauthenticated API requests return 401;
- authenticated non-allowlisted API requests return 403;
- page and API resources retain independent server-side authorization;
- authorization occurs before request body use, DB access, or OpenAI access;
- missing/blank allowlist configuration remains fail-closed;
- sign-out removes stale protected in-memory state.

`selectedPeriod` is display state only and is never used as authentication or authorization input. Spec 09 sends only an existing server-issued batch UUID as the optional transaction query parameter.

No database credential, Clerk secret, allowlisted user ID, OpenAI key, CSV, or new Transaction payload is exposed.

---

## 11. Scope In

- Dashboard period selector;
- persisted period list;
- specific-period selection;
- all-period selection;
- latest-period default;
- in-memory cross-page selection;
- selected-period Dashboard aggregation;
- selected-period Transaction Explorer scope;
- Import success synchronization;
- empty, stale, loading, failure, retry, and sign-out state handling;
- automated and manual regression verification.

---

## 12. Scope Out

- previous/next period buttons;
- monthly or yearly comparison;
- previous-period deltas;
- arbitrary date range or calendar period selection;
- budget, prediction, waste detection, or AI spending analysis;
- selected-period persistence in browser storage, cookies, URL, or DB;
- import batch deletion/replacement;
- pagination;
- new API Routes or Server Actions;
- DB schema changes or migrations;
- Transaction public type changes;
- authentication, authorization, Clerk, or single-user model changes;
- Category Cache redesign;
- DB-backed Manual Correction;
- OpenAI changes;
- MyJCB automation or scraping;
- Discord;
- PWA expansion;
- branding, metadata, manifest, or icon changes.

---

## 13. Expected File Plan

Likely new files:

- `src/lib/periods/period-selection.ts`
  - period model, ordering, latest selection, labels, and stale-selection reconciliation as pure functions.
- `src/components/periods/period-selector.tsx`
  - controlled Dashboard selector matching the existing UI.
- `tests/period-selection.test.mjs`
  - deterministic period and state-transition tests with fictional data.

Likely modified files:

- `src/lib/persistence/persistence-client.ts`
  - load import metadata and optionally load one batch; preserve queryless all-period loading.
- `src/state/transaction-context.tsx`
  - canonical session data, selection, derived display transactions, concurrency, retry, import synchronization, and sign-out cleanup.
- `src/components/import/csv-dropzone.tsx`
  - pass successful batch metadata and transactions to the Context without changing import stages.
- `src/components/dashboard/dashboard-page-content.tsx`
  - place and connect the selector.
- `src/components/transactions/transaction-explorer.tsx`
  - consume `selectedTransactions` before existing filters.
- `tests/persistence-client.test.mjs`
  - imports, specific-period, and queryless all-period request tests.
- existing Dashboard/Explorer tests only where needed for period-scope regression.

Files that must remain unchanged include DB schema/migrations, protected Route Handler contracts, auth/OpenAI logic, public `Transaction` type, category persistence, aggregation semantics, Explorer filter semantics, and branding assets/configuration.

No dependency addition is expected.

---

## 14. Test Plan

### Unit tests

- label formatting;
- `periodEnd DESC` then `periodStart DESC` ordering;
- latest selection independent of import order/time;
- explicit `all`, `batch`, and `null` semantics;
- stale selection fallback;
- no-import and one-period states;
- preservation of valid batch/all selection after import;
- first-import selection;
- immutable state transitions;
- selected subset used by Dashboard aggregation;
- existing Explorer filters applied after period scoping;
- signed amounts and duplicate rows preserved.

### Client/API integration tests

- `GET /api/imports` uses `cache: "no-store"`;
- a specific period sends one encoded `batchId` query;
- all periods send one queryless `GET /api/transactions` request;
- all periods do not issue one transaction request per batch;
- invalid response/network failure maps to the existing safe read error;
- successful import registers batch metadata and returned transactions;
- duplicate/failed import does not mutate selection.

### Regression tests

- existing Dashboard aggregation;
- existing Transaction Explorer filters and sorting;
- CSV parse/classification/persistence;
- Category Cache and Manual Correction;
- Spec 08 authorization wrapper and fail-closed behavior;
- sign-out state clearing;
- branding remains unchanged.

### Manual verification

Use fictional/anonymized statements only:

1. verify empty DB states;
2. import one period and verify default selection;
3. import multiple periods and verify ordering/latest default;
4. switch every period and verify all Dashboard outputs together;
5. select `全期間` and verify one queryless transaction request;
6. navigate to `/transactions` and verify shared scope;
7. exercise category/from/to filters inside that scope;
8. import a newer period while an older period is selected;
9. verify selection is preserved and the new option appears;
10. repeat while `全期間` is selected;
11. reload and verify latest-period reset;
12. verify retry behavior using safe request blocking;
13. verify signed-out 401 and non-allowlisted 403 behavior;
14. verify Desktop/Mobile layout and absence of page-level horizontal overflow;
15. verify storage, cookies, and URL contain no selected-period persistence.

---

## 15. Acceptance Criteria

### Period selector and default

**AC01** Dashboard上部にperiod selectorが表示される。
**AC02** Selectorに保存済みJCB利用期間が表示される。
**AC03** 利用期間は`YYYY/MM/DD〜YYYY/MM/DD`形式で表示される。
**AC04** Selectorで`全期間`を選択できる。
**AC05** 初期表示では利用期間として最新のbatchが選択される。
**AC06** 最新判定は`periodEnd DESC`を第一基準とする。
**AC07** 同一`periodEnd`では`periodStart DESC`を第二基準とする。
**AC08** `importedAt`だけを理由に古い利用期間をdefaultにしない。
**AC09** DBに1期間だけ存在する場合も正常に選択・表示できる。
**AC10** DBに複数期間存在する場合も正常に選択・表示できる。

### Selection lifecycle

**AC11** Dashboardから`/transactions`へのSPA navigationでselectionを維持する。
**AC12** `/transactions`直接表示時は最新利用期間がdefaultになる。
**AC13** reload後は保存されたselectionを復元せず最新利用期間へ戻る。
**AC14** selected periodをlocalStorageへ保存しない。
**AC15** selected periodをsessionStorageへ保存しない。
**AC16** selected periodをCookieへ保存しない。
**AC17** selected periodをDBへ保存しない。
**AC18** selected periodをURL path/queryへ保存しない。
**AC19** `null`を`全期間`として扱わない。
**AC20** stale batch selectionは最新の有効batchへfallbackする。
**AC21** period一覧が空ならselectionは安全に`null`へfallbackする。

### Dashboard

**AC22** 過去期間選択時、Total Spendingはその期間のみを集計する。
**AC23** Category Spendingは同じselected periodのみを集計する。
**AC24** Category Proportionは同じselected periodのみを集計する。
**AC25** Daily Spendingは同じselected periodのみを集計する。
**AC26** Dashboardの全表示が同一のselected Transaction集合から計算される。
**AC27** `全期間`でDashboardが全保存Transactionを集計する。
**AC28** aggregationのsigned amount、date、zero-day semanticsを変更しない。

### Transaction Explorer

**AC29** Dashboardで選択したperiodが`/transactions`へ連動する。
**AC30** Transactionsではperiod scopeを既存filterより先に適用する。
**AC31** category filterがselected period内で従来どおり動作する。
**AC32** From filterがselected period内で従来どおり動作する。
**AC33** To filterがselected period内で従来どおり動作する。
**AC34** category/from/toのAND semanticsを維持する。
**AC35** From/Toのinclusive date semanticsを維持する。
**AC36** From greater than Toの既存validationを維持する。
**AC37** newest-first sortingを維持する。
**AC38** 同一日付Transactionの既存相対順序を維持する。
**AC39** `全期間`でTransactionsが全保存Transactionを表示する。

### API and data loading

**AC40** Period一覧は既存`GET /api/imports`から取得する。
**AC41** 特定期間は既存`GET /api/transactions?batchId=<UUID>`から取得する。
**AC42** `全期間`は既存のqueryless `GET /api/transactions`から取得する。
**AC43** `全期間`の初回取得は1回のqueryless Transaction requestで完了する。
**AC44** `全期間`のためにbatch数分のTransaction requestを送らない。
**AC45** 新規API RouteまたはServer Actionを追加しない。
**AC46** API read failureをempty DBとして扱わない。
**AC47** 古いpending responseが現在のselectionを上書きしない。
**AC48** retryによって必要なperiod/Transaction dataを再取得できる。

### Empty and import behavior

**AC49** Importが0件の場合、Dashboardが正常なempty stateを表示する。
**AC50** Importが0件の場合、Transaction Explorerが正常なempty stateを表示する。
**AC51** 有効なbatch選択中の新規Import後もselectionを維持する。
**AC52** `全期間`選択中の新規Import後も`全期間`を維持する。
**AC53** 0件状態から最初のImportが成功すると新規batchを選択する。
**AC54** Import成功後、Selectorへ新しい期間が反映される。
**AC55** `全期間`選択中のImport後、全期間表示に新規Transactionが含まれる。
**AC56** Import成功後のDashboardへの即時navigationを維持する。
**AC57** 新規Import後にreloadすると最新利用期間がdefaultになる。
**AC58** duplicate/failed Importはperiod selectionやcanonical dataを変更しない。

### Regression, security, and scope

**AC59** 既存Transaction Context contractを不用意に別の意味へ変更しない。
**AC60** canonical Transaction dataとderived `selectedTransactions`を独立したSource of Truthとして二重管理しない。
**AC61** public `Transaction`型を変更しない。
**AC62** Transaction rowsを期間切替時にdeduplicateまたは変更しない。
**AC63** Manual Category CorrectionとCategory Cacheの既存semanticsを維持する。
**AC64** CSV parse、AI分類、Persistenceの既存flowを維持する。
**AC65** Spec 08のPage/API 401/403と認可前side-effect防止を維持する。
**AC66** sign-out時にTransaction、period一覧、selection、in-memory cacheをclearする。
**AC67** DB schemaおよびmigrationを変更しない。
**AC68** ブランド名`浪費対策ナビ`、metadata、manifest、iconsを変更しない。
**AC69** 前月/次月、比較、budget、予測、AI分析、任意期間選択、削除機能を追加しない。

### Verification

**AC70** 既存Spec 01–08 regression testsがPASSする。
**AC71** latest/ordering/selection/fallbackのunit testsがPASSする。
**AC72** specific-period requestのclient testがPASSする。
**AC73** all-period single queryless requestのclient testがPASSする。
**AC74** import selection lifecycleのtestがPASSする。
**AC75** selected scope後のDashboard aggregation testがPASSする。
**AC76** selected scope後のExplorer filter testがPASSする。
**AC77** `npm run lint`がPASSする。
**AC78** `npx tsc --noEmit`がPASSする。
**AC79** `npm run build`がPASSする。
**AC80** Desktop/MobileでSelectorが正常表示され、page-level horizontal overflowを追加しない。

---

## 16. Definition of Done

Spec 09 is complete only when:

1. AC01–AC80 are individually evaluated;
2. no requirement is silently marked PASS without evidence;
3. automated tests, lint, typecheck, build, and `git diff --check` pass;
4. period switching is manually verified with fictional/anonymized data;
5. Dashboard and Transaction Explorer use the same shared period selection;
6. all-period loading uses one queryless transaction request;
7. Import selection lifecycle and reload reset are manually verified;
8. Spec 08 authorization and secret boundaries regress cleanly;
9. no DB, Production, environment, branding, or out-of-scope change is introduced.

### 16.1 Final Closure Evidence

Final verification completed on 2026-09-03.

```text
PASS: 80
FAIL: 0
NOT VERIFIED: 0
BLOCKED: 0
TOTAL: 80
```

Closure evidence:

- automated tests, ESLint, TypeScript, and `git diff --check` passed;
- the production build passed in the user's local Mac environment;
- period ordering, latest selection, all-period selection, stale fallback, request shape, Dashboard aggregation, Explorer filtering, import lifecycle, Manual Correction, and security regressions were verified;
- Dashboard/Transactions cross-page selection, reload reset, empty/one/multiple-period states, all-period single-request behavior, import selection preservation, and responsive presentation were manually verified;
- no DB schema, migration, authentication, branding, environment variable, dependency, or Production change was introduced;
- only fictional/anonymized data was used for verification.

---

## 17. Implementation Gate

Implementation may begin only after this frozen Spec is reviewed and explicitly approved.

During implementation:

- implement Spec 09 only;
- use fictional/anonymized test data;
- do not modify Production, Neon, Clerk, or Vercel configuration;
- do not run destructive DB operations;
- do not commit or push until implementation and verification are reviewed;
- stop and report if an unexpected requirement would need an API contract, DB schema, authentication, or branding change.
