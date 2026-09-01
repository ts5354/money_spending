# Spec 06 --- Transaction Explorer

**Status:** READY FOR PLANNING\
**Scope:** Transaction Explorer only\
**Route:** `/transactions`

## 1. Purpose

Spec 06 adds a browser-only Transaction Explorer for transactions
already loaded into the existing Transaction Context.

The user can view loaded transactions, filter by exactly one category or
all categories, filter by an inclusive From / To date range, combine
filters with AND semantics, clear filters, see matching/total counts,
and see existing Manual Category Correction results reflected from
shared Context.

No persistence, server-side filtering, new AI behavior, or later-Spec
functionality is added.

## 2. Existing Input

Reuse the existing `Transaction` model unchanged:

``` ts
type Transaction = {
  id: string
  date: string
  merchantRaw: string
  merchantNormalized: string
  amount: number
  category: Category
  categorySource: "ai" | "cache" | "manual"
  description: string | null
  approvalNumber: string | null
}
```

Reuse the existing fixed 9-category taxonomy and `CATEGORY_LABELS`:
`convenience_store`, `supermarket`, `vending_machine`, `restaurant`,
`subscription`, `shopping`, `transportation`, `entertainment`, `other`.

## 3. Explorer Display

Each visible transaction shows only: - date - merchant (`merchantRaw`) -
category using existing Japanese label - amount

Do not normally display `approvalNumber`, `description`,
`categorySource`, internal ID, or `merchantNormalized`.

Preserve signed `Transaction.amount`; never apply `Math.abs()`.

## 4. Filter State

``` ts
type TransactionFilters = {
  category: Category | "all"
  from: string
  to: string
}
```

Initial/reset state:

``` ts
{ category: "all", from: "", to: "" }
```

Filter state is local UI state only. Do not persist it to localStorage,
sessionStorage, URL query parameters, server state, or database.

## 5. Category Filter

Single-select only, with choices: `すべて`, `コンビニ`, `スーパー`,
`自販機`, `飲食`, `サブスク`, `買い物`, `交通`, `娯楽`, `その他`.

`all` imposes no category restriction. Otherwise require:

``` ts
transaction.category === filters.category
```

## 6. Date Filter

Inclusive calendar-date boundaries: - neither set → all dates - From
only → `D >= From` - To only → `D <= To` - both → `From <= D <= To`

Both boundary dates are included. Dates are `YYYY-MM-DD` calendar dates;
do not introduce timezone conversion/date shifting merely to compare
them.

## 7. Invalid Date Range

If both dates exist and `From > To`, the state is invalid.

Show a clear message such as:

`開始日は終了日以前の日付を指定してください`

Do not crash and do not render a misleading filtered result list.
Correcting either date or clearing filters immediately restores normal
filtering.

## 8. Combined Semantics

All active filters use AND semantics:

``` ts
categoryMatches && fromMatches && toMatches
```

## 9. Pure Filtering Boundary

Separate filtering/sorting from rendering behind a pure library
boundary, e.g.:

``` ts
filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters
): Transaction[]
```

Validation may be a separate pure helper/result type.

The pure layer must not mutate input/transactions, fetch, access
storage, call a server, or call AI.

## 10. Sort Order

Display newest date → oldest date. No sort UI.

For transactions on the same date, preserve original input relative
order. Never mutate the Context-owned input array.

## 11. Result Count

For valid filters show:

`{matchingCount}件 / 全{totalCount}件`

Example: `23件 / 全155件`.

## 12. Clear Filters

Provide `条件をクリア`.

It resets category to `all` and From/To to empty, immediately updates
the list/count, and recovers from invalid ranges. It must not alter
transactions, categories, category cache, or Manual Correction state.

## 13. Empty States

### Context is `null`

Distinguish this from a zero-match result. Explain that no transaction
data is loaded and provide a clear action/route to `/import`.

### Valid filters produce zero matches

Show `条件に一致する取引はありません` (or equivalent). Keep filter
controls usable.

### Loaded empty array

Must not crash; safely communicate zero transactions.

## 14. Manual Correction Integration

Read the latest `Transaction[]` from shared Context.

If existing Manual Correction changes a transaction category, Explorer
reflects the new category on render. Active category-filter membership
must also update accordingly.

Do not add category editing controls inside Explorer. Do not change
Category Cache or Manual Correction persistence.

## 15. Route

Use existing `/transactions`.

Do not add Dashboard category-click navigation in Spec 06.

## 16. UI Composition

``` text
Transaction Explorer
├─ Page Header
├─ Filter Card
│  ├─ Category Select
│  ├─ From Date
│  ├─ To Date
│  └─ Clear Filters
├─ Result Summary
│  └─ 23件 / 全155件
└─ Transaction List
   └─ Date | Merchant | Category | Amount
```

Keep the existing MoneyForward-like light/white card visual language. Do
not redesign the application shell.

## 17. Transaction Row

Desktop: compact table-like row, preferably
`Date | Merchant | Category | Amount`, with amount visually aligned.

Mobile: stacked/compact row/card is allowed and preferred over a wide
desktop table.

Long merchant names must not cause document-level horizontal overflow.

Category meaning must include its text label, not color alone.

## 18. Responsive

Desktop filters may be one row/compact grid:
`Category | From | To | Clear`.

Mobile filters stack/wrap readably. Transactions remain readable without
page-level horizontal scrolling.

Recommended mobile hierarchy:

``` text
Merchant                     ¥600
2026/08/15                   飲食
```

Do not require horizontal scrolling of a desktop-sized transaction
table.

## 19. Accessibility / Interaction

-   understandable labels for filters
-   native date inputs acceptable
-   category not color-only
-   readable invalid-date message
-   mobile-usable controls
-   filters update immediately; no Apply button
-   Clear Filters is an accessible button

## 20. Privacy / Security Boundary

Explorer is browser-only and operates exclusively on existing
client-side `Transaction[]`.

Add no new API route, Server Action, transaction-filter fetch, OpenAI
request, transaction analytics payload, cloud persistence, transaction
localStorage persistence, or database storage.

`/api/classify`, OpenAI classification logic, and server-only
`OPENAI_API_KEY` boundary remain unchanged.

Explorer must not send transaction dates, amounts, approval numbers,
descriptions, or transaction lists to OpenAI.

## 21. Out of Scope

-   merchant keyword search
-   amount filter
-   amount sort
-   selectable sort order
-   multiple categories
-   pagination/infinite scrolling
-   transaction detail view
-   Explorer category editing
-   transaction create/delete
-   CSV export/edit
-   URL/storage filter persistence
-   transaction persistence
-   DB/auth/cloud sync
-   monthly comparison/budget
-   spending judgment / 浪費
-   category customization/cache reset
-   AI reclassification/summary
-   MyJCB auto acquisition/scraping
-   Discord
-   PWA
-   Dashboard category-click navigation
-   new server APIs
-   production test flags/artificial delays/debug backdoors

## 22. Automated Testing

Use fictional/anonymized transactions.

At minimum cover: - empty input - no filters - category filter - fixed
categories - From-only inclusive boundary - To-only inclusive boundary -
From+To inclusive boundaries - category+date combined filter - zero
matches - invalid `From > To` - newest-first - stable same-date order -
input array/object immutability - signed/negative amount preservation -
Manual Correction-like category membership change - reset behavior if
reset logic is extracted

Do not delete/weaken Spec 01--05 regression tests.

## 23. Acceptance Criteria

### Data / Display

-   **AC01** `/transactions` renders from existing Transaction Context.
-   **AC02** Visible transaction shows date.
-   **AC03** Visible transaction shows merchant.
-   **AC04** Visible transaction shows category using existing Japanese
    label.
-   **AC05** Visible transaction shows signed amount in JPY-friendly
    format.
-   **AC06** `approvalNumber` not normally displayed.
-   **AC07** `description` not normally displayed.
-   **AC08** `categorySource` not normally displayed.
-   **AC09** internal ID not normally displayed.
-   **AC10** Existing `Transaction` type need not expand.

### Category Filter

-   **AC11** Single-select category filter.
-   **AC12** Includes `すべて`.
-   **AC13** Includes existing fixed 9 categories.
-   **AC14** Reuses existing category IDs/labels.
-   **AC15** `すべて` imposes no category restriction.
-   **AC16** Selected category shows only current matching transactions.
-   **AC17** No multi-category UI.

### Date Filter

-   **AC18** From may be empty.
-   **AC19** To may be empty.
-   **AC20** Both empty means no date restriction.
-   **AC21** From-only includes From date.
-   **AC22** From-only includes later dates.
-   **AC23** To-only includes To date.
-   **AC24** To-only includes earlier dates.
-   **AC25** Both boundaries are inclusive.
-   **AC26** Dates outside range excluded.
-   **AC27** No timezone date shifting.

### Validation

-   **AC28** `From > To` detected invalid.
-   **AC29** Clear validation message shown.
-   **AC30** Invalid range does not crash.
-   **AC31** Invalid range does not show misleading filtered list.
-   **AC32** Correction/clear immediately restores filtering.

### Combined Filters

-   **AC33** Category/date use AND.
-   **AC34** Category + From-only works.
-   **AC35** Category + To-only works.
-   **AC36** Category + From + To works.

### Sorting

-   **AC37** Newest-to-oldest date order.
-   **AC38** Same-date original relative order preserved.
-   **AC39** Input array not mutated.
-   **AC40** Transaction objects not mutated.
-   **AC41** No sort control.

### Counts / Clear

-   **AC42** Matching count shown for valid state.
-   **AC43** Total loaded count shown.
-   **AC44** Format communicates `{matching}件 / 全{total}件`.
-   **AC45** No filters normally gives matching == total.
-   **AC46** `条件をクリア` exists.
-   **AC47** Clear resets category to all.
-   **AC48** Clear resets From.
-   **AC49** Clear resets To.
-   **AC50** Clear immediately restores unfiltered list.
-   **AC51** Clear recovers invalid range.
-   **AC52** Clear does not modify transactions/cache.

### Empty States

-   **AC53** Context null differs from zero-match.
-   **AC54** Context null provides `/import` action.
-   **AC55** Zero matches shows appropriate message.
-   **AC56** Filters remain usable with zero matches.
-   **AC57** Loaded empty array does not crash.

### Manual Correction

-   **AC58** Latest Context category shown.
-   **AC59** Manual Correction reflected without second transaction
    store.
-   **AC60** Corrected transaction can leave active category result.
-   **AC61** Corrected transaction can enter active category result.
-   **AC62** No Explorer category editor.
-   **AC63** Category Cache unchanged.
-   **AC64** Manual Correction persistence unchanged.

### UI / Responsive / Accessibility

-   **AC65** Desktop clearly shows Date/Merchant/Category/Amount.
-   **AC66** Desktop filters readable/compact.
-   **AC67** Mobile transactions readable without desktop-width table.
-   **AC68** Mobile filters stack/wrap.
-   **AC69** No unnecessary mobile document horizontal scroll.
-   **AC70** Long merchant names do not cause page overflow.
-   **AC71** Category not color-only.
-   **AC72** Filter controls have understandable labels.
-   **AC73** Invalid-date validation understandable.
-   **AC74** Immediate filter updates; no Apply.
-   **AC75** Clear is accessible button.

### Architecture / Privacy

-   **AC76** Pure filter/sort boundary separated from rendering.
-   **AC77** Filtering performs no server request.
-   **AC78** No new API route.
-   **AC79** No new Server Action.
-   **AC80** No transaction persistence.
-   **AC81** No filter persistence.
-   **AC82** `/api/classify` unchanged.
-   **AC83** OpenAI classification layer unchanged.
-   **AC84** Explorer sends no transaction data to OpenAI.
-   **AC85** `OPENAI_API_KEY` remains server-only.
-   **AC86** No DB/auth.

### Scope Protection

-   **AC87** No merchant keyword search.
-   **AC88** No amount filter.
-   **AC89** No selectable sorting.
-   **AC90** No multiple-category selection.
-   **AC91** No pagination/infinite scrolling.
-   **AC92** No transaction detail.
-   **AC93** No Explorer category editing.
-   **AC94** No CSV export/edit/delete.
-   **AC95** No Dashboard category-click navigation.
-   **AC96** No later-Spec feature.
-   **AC97** No production test flag/artificial delay/debug backdoor.

### Verification

-   **AC98** Automated pure filter/sort tests.
-   **AC99** Tests inclusive From/To.
-   **AC100** Tests combined category/date.
-   **AC101** Tests invalid `From > To`.
-   **AC102** Tests newest-first/stable same-date.
-   **AC103** Tests immutability.
-   **AC104** Tests zero results/empty input.
-   **AC105** Tests Manual Correction-like membership change.
-   **AC106** Existing Spec 01--05 tests remain and pass.
-   **AC107** `npm test` passes.
-   **AC108** `npm run lint` passes.
-   **AC109** `npx tsc --noEmit` passes.
-   **AC110** `npm run build` passes outside known sandbox limitation.
-   **AC111** Browser confirms category filter.
-   **AC112** Browser confirms From-only.
-   **AC113** Browser confirms To-only.
-   **AC114** Browser confirms combined category/date.
-   **AC115** Browser confirms invalid-range recovery.
-   **AC116** Browser confirms Clear Filters.
-   **AC117** Browser confirms newest-first/count.
-   **AC118** Browser confirms zero-result state.
-   **AC119** Browser confirms Desktop.
-   **AC120** Browser confirms Mobile.
-   **AC121** Browser confirms no unnecessary mobile horizontal scroll.
-   **AC122** Browser confirms latest Context category values.
-   **AC123** `.env.local` and real API keys not committed.

## 24. Definition of Done

Spec 06 is COMPLETE only when: 1. AC01--AC123 all PASS. 2.
`/transactions` uses existing Context and required display fields. 3.
Single-category + inclusive From/To filtering works independently and
together. 4. Invalid From\>To is safe and clear. 5. Newest-first stable
sorting is correct and non-mutating. 6. Counts and Clear Filters are
correct. 7. No-data and zero-match states are distinct. 8. Existing
Manual Correction updates are reflected. 9. Cache/manual persistence
unchanged. 10. Desktop/mobile/no-horizontal-overflow verified. 11. No
new server/API/AI/persistence boundary. 12. Spec 01--05 regressions
absent. 13. tests/lint/typecheck/build pass. 14. secrets remain
uncommitted. 15. Review occurs before commit/push.

## 25. Planning Gate

This document is the Source of Truth for Spec 06.

The next Codex task is **planning only**.

Codex must read `AGENTS.md`, `specs/PROJECT_SPEC.md`, completed prior
Specs, this Spec, and inspect the current repository. It must produce a
concrete implementation plan, map implementation/verification to
AC01--AC123, identify files to create/modify, and identify
conflicts/blockers.

During planning Codex must not edit application/Spec files, install
dependencies, implement code, commit, or push.

If this Spec is missing or materially conflicts with the repository,
Codex must stop and report the blocker instead of inventing
requirements.
