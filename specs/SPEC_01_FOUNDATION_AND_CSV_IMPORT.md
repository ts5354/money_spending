# Spec 01 — Application Foundation & CSV Import

**Parent Spec:** `PROJECT_SPEC.md`  
**Status:** Ready for Implementation  
**Development Stage:** MVP Spec 01  
**Implementation Boundary:** Application foundation and local CSV file selection only

## 1. Objective

Create the initial Next.js application foundation and allow the user to select a JCB CSV file using either file picker or drag-and-drop.

Spec 01 ends once a CSV file has passed basic file-level validation and its information is displayed.

Spec 01 does **not** parse JCB CSV contents. Actual JCB parsing begins in Spec 02.

## 2. User Story

> I want to select my JCB statement CSV easily so that the application can analyze it in a later processing step.

## 3. Scope

Implement:

- Next.js application foundation
- TypeScript
- Tailwind CSS
- App Router
- Global navigation
- Dashboard empty state
- CSV import page
- File picker
- Drag-and-drop
- Basic file validation
- Selected file information
- Transactions placeholder
- Basic responsive layout

## 4. Explicitly Out of Scope

Do not implement:

- Papa Parse CSV parsing
- Reading transaction rows
- JCB header validation
- Transaction[]
- Merchant normalization
- AI classification
- OpenAI API
- `/api/classify`
- Category cache
- localStorage
- Dashboard charts
- Recharts
- Transaction listing/filtering
- Database
- Authentication
- Vercel-specific AI configuration

Dependencies required only by future specs should not be installed.

## 5. Application Routes

Create:

```text
/
/import
/transactions
```

All three routes must load without 404 errors.

## 6. Application Layout

Create a shared App Router layout with common navigation.

Suggested structure:

```text
┌─────────────────────────────────────────┐
│ JCB Spending Visualizer                 │
│ Dashboard    明細    CSV取込            │
├─────────────────────────────────────────┤
│ Page content                            │
└─────────────────────────────────────────┘
```

## 7. Navigation

Links:

```text
Dashboard → /
明細      → /transactions
CSV取込   → /import
```

Use Next.js navigation mechanisms.

Navigation must remain usable on desktop and mobile.

## 8. Dashboard Empty State

`/` must display:

```text
分析するCSVがありません
JCBの利用明細CSVをアップロードしてください。
[CSVをアップロード]
```

The action navigates to `/import`.

Do not create fake spending data or placeholder charts.

## 9. CSV Import Page

Route: `/import`

Required heading:

```text
JCB利用明細をアップロード
```

Required explanation:

```text
JCBからダウンロードした利用明細CSVを選択してください。
```

Provide one CSV Drop Zone component supporting file picker and drag-and-drop.

## 10. CSV Drop Zone

Communicate:

```text
CSVをここにドロップ
または
ファイルを選択
```

Support click/button file selection, drag enter/leave/over, and drop.

Prevent default browser behavior that would open the dropped file.

## 11. File Picker

Use:

```html
accept=".csv,text/csv"
```

Do not rely on `accept` alone; validate in JavaScript too.

## 12. File Validation

Valid file:

- File exists
- File name ends in `.csv`
- Size > 0 bytes

Extension check is case-insensitive, so `.CSV` is accepted.

Do not inspect CSV contents in Spec 01.

## 13. Invalid File Type

Reject non-CSV files.

Required error:

```text
CSVファイルを選択してください。
```

## 14. Empty CSV

If `size === 0`, show:

```text
空のCSVファイルは読み込めません。
```

## 15. No File

If `file === null`, do nothing and show no unnecessary error.

## 16. Shared File Handling

File picker and drag-and-drop must use the same validation flow, e.g.:

```ts
handleFile(file: File)
```

Do not duplicate validation logic.

## 17. File State

Suggested local state:

```ts
type CsvFileState = {
  file: File | null
  error: string | null
}
```

Do not introduce a global state library.

## 18. Selected File Display

For a valid CSV, display at minimum:

```text
選択されたファイル
<File name>
<File size>
```

Do not display CSV contents.

## 19. Error State

Errors must be shown near the upload UI and not by color alone.

Selecting a valid file after an error must clear the previous error.

## 20. Drag State

Drop Zone should visually change while dragging over it and return to normal on drag leave.

Avoid excessive animation.

## 21. Import Action

After selecting a valid CSV, display:

```text
このCSVを読み込む
```

The button must be disabled in Spec 01 because parsing begins in Spec 02.

Do not expose a user-facing “not implemented” message.

## 22. Transactions Placeholder

`/transactions` must display:

```text
明細
CSVを読み込むと、ここに利用明細が表示されます。
```

Do not render fake transaction data.

## 23. Styling Requirements

Use Tailwind CSS with a light, white-card, finance-dashboard style.

Keep typography readable, spacing comfortable, decoration minimal, and primary controls responsive.

## 24. Accessibility Requirements

At minimum:

1. File selection is keyboard accessible.
2. Upload purpose is represented as text.
3. Errors use text, not color alone.
4. Navigation uses semantic links.
5. Buttons use button elements.
6. File input labeling is accessible.
7. Focus behavior is visible/reasonable.

## 25. Suggested Components

```text
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── import/
│   │   └── page.tsx
│   └── transactions/
│       └── page.tsx
└── components/
    ├── layout/
    │   └── navigation.tsx
    └── import/
        └── csv-dropzone.tsx
```

Do not create unused future directories.

## 26. Acceptance Criteria

- **AC-01** Next.js TypeScript application starts successfully.
- **AC-02** `/` renders Dashboard without error.
- **AC-03** `/import` renders CSV Import without error.
- **AC-04** `/transactions` renders placeholder without error.
- **AC-05** Global navigation reaches Dashboard / 明細 / CSV取込.
- **AC-06** Dashboard shows `分析するCSVがありません` and link to `/import`.
- **AC-07** File picker accepts valid `.csv`.
- **AC-08** Drag-and-drop accepts valid `.csv`.
- **AC-09** Valid CSV shows file name and size.
- **AC-10** Non-CSV shows `CSVファイルを選択してください。`
- **AC-11** Zero-byte CSV shows `空のCSVファイルは読み込めません。`
- **AC-12** Valid selection after error clears error.
- **AC-13** Drop Zone has distinct drag-over state.
- **AC-14** Drag leave restores normal state.
- **AC-15** Picker/drop share validation logic.
- **AC-16** `このCSVを読み込む` appears and is disabled.
- **AC-17** Transactions placeholder text is shown.
- **AC-18** Primary UI works on desktop and mobile.
- **AC-19** Selecting CSV does not upload it to server.
- **AC-20** No OpenAI logic or AI endpoint exists.
- **AC-21** No Spec 02+ functionality is implemented.

## 27. Validation Test Cases

```text
statement.csv, size > 0   → valid
statement.CSV, size > 0   → valid
statement.pdf             → CSVファイルを選択してください。
statement.xlsx            → CSVファイルを選択してください。
empty.csv, size = 0       → 空のCSVファイルは読み込めません。
```

## 28. Component Test Scenarios

Where a component-testing setup exists or is reasonably introduced:

1. Valid CSV via file picker → name/size visible, no error.
2. Valid CSV via drop → same result.
3. Invalid file → correct error.
4. Empty CSV → empty-file error.
5. Invalid then valid → error clears and valid file appears.

## 29. Manual Acceptance Test

Use an actual JCB statement CSV.

Example:

```text
20260716-20260815_debitmeisai.csv
```

Steps:

1. Start app.
2. Open `/`.
3. Confirm Dashboard empty state.
4. Click `CSVをアップロード`.
5. Confirm `/import`.
6. Drag JCB CSV onto Drop Zone.
7. Confirm file name.
8. Confirm file size.
9. Confirm no validation error.
10. Confirm `このCSVを読み込む`.
11. Confirm button disabled.
12. Open `/transactions`.
13. Confirm placeholder.
14. Test non-CSV.
15. Confirm validation error.
16. Select valid CSV again.
17. Confirm error clears.

The CSV contents should not yet be parsed.

## 30. Quality Gate

Run:

```bash
npm run lint
npm run build
```

Both must pass.

If tests are configured, also run the repository's test command.

No TypeScript compilation errors may remain.

## 31. Definition of Done

Spec 01 is done when:

```text
Next.js foundation
+
Three routes
+
Global navigation
+
Dashboard empty state
+
CSV Import UI
+
File picker
+
Drag-and-drop
+
Basic validation
+
Selected file display
+
Responsive foundation
+
No CSV parsing
+
No AI functionality
+
Lint passes
+
Build passes
```

## 32. Handoff Contract for Spec 02

Spec 01 produces a validated browser `File`.

Spec 02 extends the existing import flow:

```text
File
  ↓
Read CSV text
  ↓
Recognize supported JCB structure
  ↓
Locate transaction section
  ↓
Parse rows
  ↓
Transaction[]
```
