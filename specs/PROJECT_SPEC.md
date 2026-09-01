# JCB Spending Visualizer — Project Specification

**Version:** 1.0  
**Status:** Approved for MVP Development  
**Development Method:** Spec-Driven Development  
**Target Release:** MVP v1.0

## 1. Overview

JCB Spending Visualizer is a personal web application for analyzing spending recorded in JCB credit card statement CSV files.

The application imports a JCB CSV, classifies merchants into predefined spending categories, and visualizes where money was spent during the statement period.

The product does not judge whether spending is good, bad, necessary, or wasteful. Its responsibility is to organize and visualize spending data so the user can make their own decisions.

## 2. Product Goal

Allow the user to understand what they spent money on during the past month through category-based visualization of JCB transaction data.

The application should answer questions such as:

- Which category had the highest spending?
- What percentage of total spending was food?
- How did daily spending change during the month?
- Which transactions belong to a specific category?

## 3. Target User

The MVP is designed for a single personal user.

MVP v1.0 does not require registration, login, user accounts, authorization, or multi-user support.

## 4. Product Principles

1. Make spending understandable at a glance.
2. Keep CSV import simple.
3. Keep financial data in the browser whenever possible.
4. Use AI only where it provides clear value.
5. Allow AI classifications to be corrected manually.
6. Avoid unnecessary MVP features.
7. Prefer simple architecture over premature scalability.
8. Keep future extension possible through clear responsibility boundaries.

## 5. Primary User Flow

```text
Open application
  ↓
Dashboard
  ↓
No CSV loaded
  ↓
CSV upload empty state
  ↓
CSV Import
  ↓
Select or drag-and-drop JCB CSV
  ↓
Parse CSV inside browser
  ↓
Convert valid rows into Transaction[]
  ↓
Extract merchants
  ↓
Check category cache
  ↓
Classify unknown merchants using AI
  ↓
Apply categories
  ↓
Dashboard
  ↓
Visualize spending
  ↓
Open category transaction list if needed
```

## 6. Application Pages

### `/`

Dashboard:

- Empty state before CSV import
- Total spending
- Category spending
- Category percentages
- Daily spending trend
- Navigation to filtered transactions

### `/import`

JCB CSV Import:

- File selection
- Drag-and-drop
- CSV validation
- CSV parsing
- Starting analysis

### `/transactions`

Transaction Explorer:

- Transaction list
- Category filtering
- Date filtering
- Manual category correction

## 7. JCB CSV Parsing

The parser must identify the relevant JCB transaction section instead of assuming the entire CSV represents transactions.

Expected transaction section:

```text
◆ご利用明細内訳（お振替済分）
```

The parser must locate its transaction header and extract relevant transaction rows.

Original merchant text must be preserved.

## 8. Domain Model

```ts
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

`merchantRaw` preserves the original CSV value.

## 9. Categories

```ts
type Category =
  | "convenience_store"
  | "supermarket"
  | "vending_machine"
  | "restaurant"
  | "subscription"
  | "shopping"
  | "transportation"
  | "entertainment"
  | "other"
```

Display labels:

```text
convenience_store → コンビニ
supermarket       → スーパー
vending_machine   → 自販機
restaurant        → 飲食
subscription      → サブスク
shopping          → 買い物
transportation    → 交通
entertainment     → 娯楽
other             → その他
```

AI must select only from these categories and must not create new ones.

## 10. AI Merchant Classification

Rule-based enumeration of every merchant is not the primary strategy.

Unknown merchants are classified using AI.

```text
Merchant
  ↓
Category Cache
  ↓
Cache hit?
 ├─ Yes → Use cache
 └─ No  → AI Classification → Cache result
```

Unknown merchants should be deduplicated and batched when practical.

## 11. AI Provider Architecture

The MVP initially uses OpenAI API.

AI integration must be isolated behind application-specific logic so the provider can be replaced later without changing Dashboard or transaction UI code.

```ts
interface MerchantClassifier {
  classify(merchants: string[]): Promise<CategoryResult[]>
}
```

## 12. AI Output Contract

Conceptual output:

```json
{
  "results": [
    {
      "merchant": "マルエツ 中川駅前",
      "category": "supermarket"
    }
  ]
}
```

Output must be structured and validated.

Only project-defined categories may be accepted.

## 13. Category Cache

Merchant classifications are persisted in browser `localStorage`.

Transaction history itself is not persisted in localStorage for MVP v1.0.

## 14. Manual Category Correction

The user can manually change a transaction category.

The correction must update current transaction state and Dashboard aggregation immediately.

Detailed cache behavior is defined by the corresponding child spec.

## 15. Analytics

```ts
type CategorySummary = {
  category: Category
  totalAmount: number
  transactionCount: number
  percentage: number
}

type DailySummary = {
  date: string
  totalAmount: number
}
```

Analytics logic must be independent from chart components.

## 16. Dashboard

Dashboard must eventually provide:

- Total spending
- Category spending bar chart
- Category spending pie chart
- Daily spending line chart

Users must be able to navigate from a category to associated transactions.

## 17. Transaction Explorer

Display at minimum:

- Date
- Merchant
- Amount
- Category

Filters:

- Category
- Date

The user can manually change categories.

## 18. Technology Stack

- Next.js with App Router
- TypeScript
- Tailwind CSS
- Recharts
- Papa Parse
- Vercel
- OpenAI API
- Responses API
- Structured Outputs
- localStorage
- No database for MVP v1.0

Use an appropriate small, low-cost model suitable for classification.

Do not couple product architecture to a specific model identifier.

## 19. System Architecture

```text
┌────────────────────────────────────┐
│ Browser                            │
│ Next.js UI                         │
│ CSV Import / Parser                │
│ Transaction State                  │
│ Category Cache                     │
│ Analytics / Recharts               │
└─────────────────┬──────────────────┘
                  │ unknown merchants
                  ▼
┌────────────────────────────────────┐
│ Vercel / Next.js Server            │
│ POST /api/classify                 │
│ OPENAI_API_KEY                     │
└─────────────────┬──────────────────┘
                  ▼
┌────────────────────────────────────┐
│ OpenAI API                         │
│ Merchant classification            │
│ Structured output                  │
└────────────────────────────────────┘
```

## 20. Privacy Architecture

The complete CSV file must not be uploaded to the server.

CSV parsing happens client-side.

Do not send transaction amounts, dates, approval numbers, complete CSV contents, or unnecessary transaction information to OpenAI.

Only merchant information required for classification may be sent.

## 21. API Key Security

Use server-side:

```text
OPENAI_API_KEY
```

Never use:

```text
NEXT_PUBLIC_OPENAI_API_KEY
```

Required call path:

```text
Browser
  ↓
POST /api/classify
  ↓
Next.js Server
  ↓
OpenAI API
```

## 22. Application State

MVP transaction data is temporary.

Transaction[], Dashboard aggregations, daily summaries, and current filters may be lost on reload or browser termination.

A database must not be introduced in MVP v1.0.

## 23. UI / UX Direction

- Light interface
- White background
- Card-based layout
- Clear typography
- Prominent numbers and charts
- Limited decoration
- Minimal animation
- Responsive design

The design may take inspiration from modern finance dashboards such as Money Forward without copying proprietary visual assets.

## 24. Error Handling Principles

Errors must not crash the entire application.

Expected errors include invalid file, empty CSV, unsupported JCB format, no transactions found, AI request failure, and invalid AI response.

AI classification failure may temporarily fall back to `other` where appropriate.

## 25. Architectural Constraints

1. Do not upload complete CSV to server.
2. Do not expose OpenAI API keys to client code.
3. Do not allow AI to create arbitrary categories.
4. Keep AI provider code outside presentation components.
5. Keep CSV parsing outside Dashboard components.
6. Keep analytics logic outside chart components.
7. Do not introduce database for MVP.
8. Do not introduce authentication for MVP.
9. Do not implement unspecified features.
10. Keep child specs independently verifiable.
11. Prefer simple implementations over premature abstraction.
12. Preserve original merchant values.

## 26. Explicitly Out of Scope

MVP v1.0 does not include:

- Waste detection/scoring
- Spending judgment
- Budget management
- Discord integration
- MyJCB automatic acquisition/scraping
- Bank account integration
- Credit card API integration
- Real-time notifications
- AI financial advice
- Monthly comparison
- Long-term CSV history
- Database transaction persistence
- Authentication
- Multiple users
- Native iOS/Android apps

## 27. Development Specs

```text
Spec 01 — Application Foundation & CSV Import
Spec 02 — JCB CSV Parsing
Spec 03 — AI Category Classification
Spec 04 — Category Cache & Manual Correction
Spec 05 — Dashboard Visualization
Spec 06 — Transaction Explorer
```

Each spec should be completed and verified before beginning the next one.

## 28. MVP Definition of Done

MVP is complete when the app is available through Vercel, imports JCB CSV by picker/drop, parses valid transactions, classifies merchants, caches classifications, supports manual correction, visualizes totals/category shares/daily trend, supports category/date filtering, keeps complete CSV off the server, and does not expose OpenAI credentials to the browser.

## 29. Future Scope

Potential post-MVP work:

- Multiple month persistence
- Monthly comparisons
- Database
- Authentication
- Custom categories
- MyJCB integration
- Notifications
- PWA
- Advanced analytics
- AI summaries

## 30. Final Product Boundary

> Convert a JCB CSV statement into understandable category-based spending visualization.

The application organizes financial information. It does not decide whether spending is good, bad, necessary, or wasteful.
