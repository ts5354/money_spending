# SPEC_02_JCB_CSV_PARSING.md

## 1. Spec Metadata

- **Spec ID**: SPEC-02
- **Title**: JCB CSV Parsing
- **Status**: Ready for Implementation
- **Parent Spec**: `specs/PROJECT_SPEC.md`
- **Depends On**: `specs/SPEC_01_FOUNDATION_AND_CSV_IMPORT.md`
- **Next Spec**: `specs/SPEC_03_AI_CATEGORY_CLASSIFICATION.md`
- **Scope Type**: Feature / Client-side CSV Parsing

---

## 2. Purpose

本Specの目的は、Spec 01で選択可能になったJCB利用明細CSVを**ブラウザ内で読み取り**、対象となるJCB利用明細セクションのみを安全に解析し、後続処理で利用可能な `ParsedTransaction[]` に変換することです。

本Specでは、JCB CSVの解析だけを担当します。

以下は行いません。

- AIによるカテゴリ分類
- OpenAI API呼び出し
- カテゴリキャッシュ
- localStorage保存
- Dashboardグラフ生成
- 明細フィルタリング
- 手動カテゴリ修正
- Database保存
- Authentication
- CSVファイルのServer送信

CSVはブラウザ内で処理し、ファイル本体をServerへ送信してはいけません。

---

## 3. Product Context

本プロジェクトは、ユーザー自身のJCB利用明細をカテゴリ別に整理し、分かりやすく可視化する個人向けWebアプリです。

Spec 01では以下まで実装されています。

```text
CSV File
   ↓
File Picker / Drag & Drop
   ↓
Basic Validation
   ↓
Valid File Selected
```

Spec 02では、これを以下まで拡張します。

```text
CSV File
   ↓
Read CSV Text
   ↓
Parse CSV
   ↓
Recognize Supported JCB Structure
   ↓
Locate Settled Transaction Section
   ↓
Parse Transaction Rows
   ↓
ParsedTransaction[]
   ↓
Navigate to Dashboard
```

カテゴリ分類はSpec 03で行います。

---

## 4. Scope

### 4.1 In Scope

本Specで実装する内容：

- Papa Parseの導入
- 選択済みCSVファイルのブラウザ内読み取り
- UTF-8 / UTF-8 with BOM のJCB CSVへの対応
- JCB CSV構造の認識
- 対象セクションの探索
- 対象ヘッダーの検証
- 利用明細行の抽出
- 明細行から `ParsedTransaction` への変換
- 日付の正規化
- 金額の数値化
- 店名の基本正規化
- `ParsedTransaction.id` の生成
- 摘要・承認番号の取り込み
- 不正CSV・非対応JCB CSV・明細0件のエラー処理
- Spec 01の「このCSVを読み込む」ボタンの有効化
- 正常解析後のDashboard遷移
- 解析結果をアプリ内のクライアント状態として保持
- CSV本体をServerへ送信しないことの保証
- CSV解析ユーティリティのテスト

### 4.2 Out of Scope

本Specでは以下を実装しません。

- AIカテゴリ分類
- OpenAI SDK
- `/api/classify`
- カテゴリ固定値への割り当て
- localStorageカテゴリキャッシュ
- カテゴリ手動修正
- Recharts
- Dashboardのグラフ
- Dashboard集計ロジック
- 明細一覧の完成版
- カテゴリ・日付フィルタ
- Database
- Authentication
- MyJCB自動取得
- スクレイピング
- 複数CSVの永続保存
- 月次比較
- CSVサーバーアップロード
- approvalNumberをUIへ表示する機能

---

## 5. Supported JCB CSV Format

本Specでは、JCBからダウンロードした以下の構造を持つCSVを対象とします。

代表例：

```csv
"2026/08/31"
"19:01時点"
"対象期間","2026年7月16日～2026年8月15日"

"◆ご利用明細内訳（お振替済分）"
"ご利用者","お振替日","ご利用先など","お振替金額（￥）","摘要","承認番号"
"1189","2026/08/15","ＯＰＥＮ　ＮＡＫＡＭＥＧＵＲＯ／Ａｉｒ","600","Ａｐｐｌｅ　Ｐａｙ／ＱＵＩＣＰａｙご利用分","[433089]"
```

ファイル末尾には、対象外の別セクションが存在する場合があります。

例：

```text
◆ご利用明細内訳（差額分・お振替未済分）
◆キャッシュバック
◆年会費
```

本Specでは、原則として次のセクションのみを解析対象とします。

```text
◆ご利用明細内訳（お振替済分）
```

---

## 6. Section Boundary Rules

### 6.1 Start Marker

解析開始位置は、CSV内で完全一致する以下のセルを探索して決定します。

```text
◆ご利用明細内訳（お振替済分）
```

このセクションが存在しない場合は、対応していないJCB CSVとしてエラーにします。

### 6.2 Required Header

Start Markerの後に、以下のヘッダー行が存在する必要があります。

```text
ご利用者
お振替日
ご利用先など
お振替金額（￥）
摘要
承認番号
```

列順は上記を標準とします。

実装は列名からindexを解決し、不要に固定indexへ依存しない設計を推奨します。

必要な列が不足している場合は解析エラーとします。

### 6.3 End Boundary

対象セクションの終了条件は以下のいずれかです。

1. `◆` で始まる新しいセクション見出し行に到達した
2. CSV末尾に到達した

対象セクションの後にある、

```text
◆ご利用明細内訳（差額分・お振替未済分）
◆キャッシュバック
◆年会費
```

などの行をTransactionとして解析してはいけません。

### 6.4 Blank Rows

セクション内の空行は無視します。

---

## 7. Domain Model

### 7.1 Parent Specとの型境界

Parent Project Specでは最終的なTransactionとしてカテゴリ情報を含む型が定義されています。

しかしSpec 02時点ではAIカテゴリ分類をまだ実施しません。

そのため、本SpecではCSV解析専用の中間モデル `ParsedTransaction` を導入します。

これはParent Specの設計意図を変更するものではなく、Spec 03までの責務分離を明確にするための中間型です。

### 7.2 ParsedTransaction

```ts
export type ParsedTransaction = {
  id: string
  date: string
  merchantRaw: string
  merchantNormalized: string
  amount: number
  description: string | null
  approvalNumber: string | null
}
```

### 7.3 Field Definitions

#### `id`

Transactionをクライアント内で一意に識別する文字列。

本Specでは、CSV内の個人識別情報をそのままIDとして使用しません。

推奨方式：

```text
date + merchantRaw + amount + approvalNumber + rowIndex
```

などの入力から、安定したローカルIDを生成します。

実装方法は以下のいずれかで構いません。

- 決定的な文字列ID
- 安定したhash
- 同一解析内で一意なID

ただし、以下は禁止します。

- `ご利用者` の値だけをIDとして使う
- 承認番号だけをIDとして使う
- ランダムIDのみで重複判定まで兼ねる

#### `date`

`お振替日` をISO形式へ正規化します。

入力：

```text
2026/08/15
```

出力：

```text
2026-08-15
```

不正な日付は行単位で黙って補正せず、解析エラーとして扱います。

#### `merchantRaw`

JCB CSVの `ご利用先など` を、内容を失わない形で保持します。

例：

```text
ＯＰＥＮ　ＮＡＫＡＭＥＧＵＲＯ／Ａｉｒ
```

原文のトリミングは可能ですが、意味を変える加工をしてはいけません。

#### `merchantNormalized`

後続のAI分類・キャッシュキーに使用する基本正規化済み店名です。

本Specで許可する正規化：

- 前後空白削除
- Unicode NFKC正規化
- 連続空白の単一空白化
- 全角スペースと半角スペースの統一
- 制御文字除去

本Specでは以下を行いません。

- 店舗名推測
- ブランド名推測
- `/Air` のような決済サービス表記の意味的除去
- QUICPay表記から店舗名を推測
- AIによる補正
- 辞書ベースカテゴリ分類

つまり、

```text
ＯＰＥＮ　ＮＡＫＡＭＥＧＵＲＯ／Ａｉｒ
```

をNFKC等により、

```text
OPEN NAKAMEGURO/Air
```

程度へ正規化することは許可しますが、

```text
OPEN NAKAMEGURO
```

へ意味的に書き換える処理は本Specでは行いません。

#### `amount`

`お振替金額（￥）` をJavaScriptのnumberへ変換します。

例：

```text
"600"
```

↓

```ts
600
```

カンマ付き数値にも対応します。

例：

```text
"12,345"
```

↓

```ts
12345
```

数値化できない値は解析エラーとします。

本アプリでは支出額として扱うため、通常の正の利用金額を想定します。

返金・負値など特殊な値が現れた場合、勝手に絶対値へ変換してはいけません。

#### `description`

JCB CSVの `摘要`。

空文字の場合：

```ts
null
```

それ以外：

```ts
string
```

#### `approvalNumber`

JCB CSVの `承認番号`。

空文字の場合：

```ts
null
```

それ以外：

```ts
string
```

例：

```text
[433089]
```

本Specでは、承認番号を解析結果として保持することは許可しますが、Dashboardや明細画面へ表示してはいけません。

---

## 8. Fields Not Stored

JCB CSVの `ご利用者` は、本Specの `ParsedTransaction` に保存しません。

理由：

- MVPで不要
- 個人識別性のあるデータを不要にアプリ状態へ保持しない
- 分析結果に必要ない

CSV解析時に列として存在することは確認しても構いませんが、Transactionへコピーしてはいけません。

---

## 9. CSV Reading Rules

### 9.1 Processing Location

CSVファイルは必ずブラウザ内で処理します。

禁止：

```text
Browser
  ↓ CSV file
Server / API route
```

許可：

```text
Browser
  ↓ File.text() / Papa Parse
Browser Memory
```

### 9.2 Encoding

想定：

- UTF-8
- UTF-8 with BOM

UTF-8 BOMが存在する場合は、解析時に問題なく処理できること。

本SpecではShift_JIS対応を必須にしません。

### 9.3 Parser

Papa Parseを使用します。

導入Dependency：

```text
papaparse
```

TypeScript型が必要な場合：

```text
@types/papaparse
```

### 9.4 Parsing Strategy

JCB CSVは通常の1行目ヘッダー形式ではないため、Papa Parseの `header: true` をファイル全体へ直接適用しません。

まずraw row配列として解析することを推奨します。

概念例：

```ts
Papa.parse<string[]>(text, {
  skipEmptyLines: false,
})
```

その後：

1. セクション見出し探索
2. 対象ヘッダー探索
3. 列index解決
4. 明細行変換

を行います。

---

## 10. Parsing Algorithm

推奨フロー：

```text
File
 ↓
Read as text
 ↓
Papa Parse → rows[][]
 ↓
Find "◆ご利用明細内訳（お振替済分）"
 ↓
Find required header row
 ↓
Resolve column indexes
 ↓
Iterate following rows
 ↓
Stop on next "◆..." section
 ↓
Ignore blank rows
 ↓
Validate each transaction row
 ↓
Convert row → ParsedTransaction
 ↓
Return ParsedTransaction[]
```

---

## 11. Parser API

推奨ファイル：

```text
src/lib/csv/parse-jcb-csv.ts
```

推奨インターフェース：

```ts
export async function parseJcbCsv(
  file: File
): Promise<ParsedTransaction[]>
```

または、読み込み処理と純粋な解析処理を分離しても構いません。

推奨：

```ts
export async function readJcbCsvFile(
  file: File
): Promise<string>

export function parseJcbCsvText(
  text: string
): ParsedTransaction[]
```

テスト容易性のため、後者のように「File読み込み」と「CSV解析」を分離する設計を推奨します。

ただし過剰な抽象化や汎用CSVフレームワークは作らないでください。

---

## 12. Errors

### 12.1 Error Type

推奨：

```ts
export type JcbCsvParseErrorCode =
  | "READ_FAILED"
  | "INVALID_CSV"
  | "UNSUPPORTED_JCB_FORMAT"
  | "MISSING_TRANSACTION_SECTION"
  | "MISSING_REQUIRED_HEADER"
  | "INVALID_TRANSACTION_ROW"
  | "NO_TRANSACTIONS"

export class JcbCsvParseError extends Error {
  code: JcbCsvParseErrorCode
}
```

完全一致は必須ではありませんが、UIが原因別に扱える構造化エラーにしてください。

### 12.2 User-facing Error Messages

UIでは最低限以下を区別します。

#### CSV読み込み失敗

```text
CSVファイルを読み込めませんでした。
```

#### JCB形式ではない / 対応形式ではない

```text
対応しているJCB利用明細CSVではありません。
```

#### 対象明細がない

```text
利用明細が見つかりませんでした。
```

内部エラー詳細、stack trace、承認番号等を画面へ表示してはいけません。

---

## 13. Invalid Row Policy

本Specでは、対象セクション内にTransactionらしい行が存在するにもかかわらず、必須フィールドが壊れている場合、**その行を黙ってスキップしません**。

以下の必須値：

- お振替日
- ご利用先など
- お振替金額（￥）

のいずれかが不正な場合、CSV全体の解析を失敗させます。

理由：

- 支出総額が静かに欠落することを防ぐ
- Dashboardの数値が不正確になることを防ぐ
- MVPでは「多少欠落しても表示」より正確性を優先する

---

## 14. Empty / Zero Transaction Policy

対象セクションが存在しても、有効なTransactionが0件の場合：

```text
NO_TRANSACTIONS
```

として扱います。

UI：

```text
利用明細が見つかりませんでした。
```

---

## 15. Duplicate Policy

本Specでは、CSV内に同一内容の行が複数存在しても、自動的な重複削除は行いません。

理由：

- 同日・同店舗・同額の正当な複数利用があり得る
- 承認番号が常に信頼できる一意キーとは限らない
- 誤ったdeduplicationによる支出欠落を避ける

CSVに存在する明細行は原則1行＝1Transactionとして保持します。

将来、複数CSV統合時の重複排除が必要になった場合は別Specで定義します。

---

## 16. Application State

Spec 02では解析後の `ParsedTransaction[]` を、ページ遷移後も利用可能な**クライアント側の一時状態**として保持します。

要件：

- Databaseへ保存しない
- localStorageへTransactionを保存しない
- Serverへ送信しない
- ページリロード後に消えてもよい
- ブラウザを閉じたら消えてよい

実装方法は過剰にならないものを選びます。

例：

- React Context
- 小規模なclient-side store

不要なグローバル状態ライブラリは導入しないことを推奨します。

---

## 17. Spec 01 UI Integration

Spec 01の `/import` を拡張します。

### 17.1 Current

Spec 01：

```text
Valid CSV Selected
 ↓
File name / size display
 ↓
[このCSVを読み込む] disabled
```

### 17.2 Spec 02

Spec 02では、有効なCSVファイル選択後：

```text
Valid CSV Selected
 ↓
[このCSVを読み込む] enabled
 ↓ click
Parsing
 ↓
Success → Dashboard
Failure → Error
```

### 17.3 Button

ラベル：

```text
このCSVを読み込む
```

状態：

- ファイル未選択 → disabled
- Spec 01 validation error → disabled
- 有効ファイル選択 → enabled
- Parsing中 → disabled

Parsing中は最低限、重複クリックを防止します。

表示例：

```text
読み込み中...
```

過度なローディング演出は不要です。

---

## 18. Navigation After Successful Parse

解析成功後：

```text
router.push("/")
```

でDashboardへ遷移します。

Parent Specの要件に従い、確認画面は挟みません。

```text
CSV Import
 ↓
Parse Success
 ↓
Dashboard
```

ただしSpec 05まではグラフを実装しないため、Dashboardでは少なくとも「CSVが読み込まれた状態」であることが分かる最低限の状態表示のみ許可します。

Spec 05のチャートを先回りして実装してはいけません。

---

## 19. Dashboard Temporary State

Spec 02完了時点で `/` は以下の2状態を区別できる必要があります。

### No CSV

Spec 01と同じ：

```text
分析するCSVがありません
JCBの利用明細CSVをアップロードしてください。
```

### CSV Parsed

最低限：

```text
CSVを読み込みました
{N}件の利用明細を読み込みました。
```

など、Transactionが存在することを示すプレースホルダーを表示します。

この段階では以下を表示しません。

- 合計金額カード
- カテゴリ別グラフ
- 円グラフ
- 日別折れ線
- カテゴリ集計
- AIカテゴリ

これらは後続Specの責務です。

---

## 20. Privacy Requirements

本Specは以下を厳守します。

### Browser Only

CSVファイル本体：

```text
Browser only
```

### Serverへ送信禁止

以下は禁止：

- fetchでCSV送信
- FormDataでCSV送信
- Server ActionへFile送信
- API RouteへFile送信
- Cloud Storage upload

### Logging

Production codeで以下をconsoleへ出力しないでください。

- CSV全文
- 全Transaction
- 承認番号一覧
- ご利用者番号

開発用ログを残す場合も個人情報・明細内容を避けます。

---

## 21. Security Requirements

- CSVセルをHTMLとして解釈しない
- `dangerouslySetInnerHTML`を使用しない
- CSV値をコードとして評価しない
- `eval`を使用しない
- CSV内容からURL等を自動実行しない

将来的なCSV Formula Injection対策として、CSV値をExcelへ再出力する機能は本Specでは実装しません。

---

## 22. Suggested File Structure

```text
src/
├── app/
│   ├── page.tsx
│   └── import/
│       └── page.tsx
├── components/
│   └── import/
│       └── csv-dropzone.tsx
├── lib/
│   └── csv/
│       ├── parse-jcb-csv.ts
│       └── normalize-merchant.ts
├── state/
│   └── transaction-context.tsx
└── types/
    └── transaction.ts
```

構造は実装状況に応じて多少変更可能です。

ただし、以下はまだ作りません。

```text
src/lib/ai/
src/lib/analytics/
src/lib/categories/
src/app/api/classify/
```

---

## 23. Dependency Policy

Spec 02で新規追加を許可するDependency：

```text
papaparse
```

必要な場合：

```text
@types/papaparse
```

それ以外のDependency追加は原則不要です。

特に以下は追加禁止：

```text
openai
recharts
zustand
redux
prisma
drizzle
firebase
supabase
next-auth
```

状態管理のためだけに外部ライブラリを追加しないでください。

---

## 24. Testing Requirements

Parserロジックには自動テストを追加します。

既存テスト基盤がない場合、本SpecではParserの正確性が重要なため、最小限のテスト基盤追加を許可します。

ただし、重いE2E環境を必須にはしません。

### Required Parser Test Cases

最低限以下を検証します。

#### Test 01 — Standard JCB CSV

正常なJCB CSVからTransactionが取得できる。

#### Test 02 — Section Selection

`◆ご利用明細内訳（お振替済分）` のみ解析し、

```text
◆ご利用明細内訳（差額分・お振替未済分）
◆キャッシュバック
◆年会費
```

などを解析しない。

#### Test 03 — Header Recognition

必須ヘッダーを正しく認識する。

#### Test 04 — Missing Section

対象セクションがないCSVでエラー。

#### Test 05 — Missing Header

必須ヘッダー不足でエラー。

#### Test 06 — Date Conversion

```text
2026/08/15
```

↓

```text
2026-08-15
```

#### Test 07 — Amount Conversion

```text
600
```

↓

```ts
600
```

および、

```text
12,345
```

↓

```ts
12345
```

#### Test 08 — Merchant Normalization

全角英数字・全角スペース等がNFKCベースで正規化される。

`merchantRaw` は原文を保持する。

#### Test 09 — Blank Optional Fields

空の摘要・承認番号が `null` になる。

#### Test 10 — Invalid Transaction Row

日付、店名、金額の必須値が壊れているTransaction行で解析失敗する。

#### Test 11 — No Transactions

対象セクションが存在するが明細0件の場合エラー。

#### Test 12 — Duplicate Rows

同一内容の2行を勝手に1件へ減らさない。

#### Test 13 — UTF-8 BOM

UTF-8 BOM付きCSVを解析できる。

---

## 25. Acceptance Criteria

### AC-01

Papa ParseがDependencyとして導入されている。

### AC-02

CSVファイルの内容がブラウザ内で読み取られる。

### AC-03

CSVファイル本体がServerへ送信されない。

### AC-04

`◆ご利用明細内訳（お振替済分）` セクションを検出できる。

### AC-05

対象セクション以外のJCBセクションをTransactionとして解析しない。

### AC-06

以下の必須ヘッダーを認識できる。

- ご利用者
- お振替日
- ご利用先など
- お振替金額（￥）
- 摘要
- 承認番号

### AC-07

正常CSVから `ParsedTransaction[]` を生成できる。

### AC-08

`お振替日` が `YYYY-MM-DD` へ正規化される。

### AC-09

`お振替金額（￥）` がnumberへ変換される。

### AC-10

`merchantRaw` がJCB CSVの元店名を保持する。

### AC-11

`merchantNormalized` が定義された基本正規化のみを行う。

### AC-12

摘要が空の場合 `description: null` になる。

### AC-13

承認番号が空の場合 `approvalNumber: null` になる。

### AC-14

`ご利用者` の値を `ParsedTransaction` に保存しない。

### AC-15

各ParsedTransactionが同一解析内で一意な `id` を持つ。

### AC-16

対象セクションが存在しないCSVをエラーとして扱う。

### AC-17

必須ヘッダー不足をエラーとして扱う。

### AC-18

壊れた必須Transaction行を黙ってスキップしない。

### AC-19

対象Transactionが0件の場合にエラーを表示する。

### AC-20

同一内容の複数Transactionを自動deduplicateしない。

### AC-21

UTF-8 BOM付きCSVを解析できる。

### AC-22

有効CSV選択時に「このCSVを読み込む」ボタンが有効になる。

### AC-23

CSV解析中は「このCSVを読み込む」ボタンが無効になる。

### AC-24

解析成功後、自動的に `/` へ遷移する。

### AC-25

解析後の `ParsedTransaction[]` がクライアント一時状態として利用可能である。

### AC-26

TransactionをlocalStorageへ保存しない。

### AC-27

解析成功後のDashboardがCSV未読込状態と読込済み状態を区別できる。

### AC-28

Dashboardグラフ・カテゴリ集計・AI分類を実装していない。

### AC-29

OpenAI関連コード・API Route・Dependencyを追加していない。

### AC-30

Database・Authenticationを追加していない。

### AC-31

CSV全文、承認番号一覧、ご利用者番号をProductionログへ出力していない。

### AC-32

Parserの主要正常系・異常系に自動テストが存在する。

### AC-33

`npm run lint` が成功する。

### AC-34

通常のローカル開発環境で `npm run build` が成功する。

### AC-35

Spec 03以降の機能を先回りして実装していない。

---

## 26. Manual Verification

実ブラウザで最低限以下を確認します。

1. `/import` を開く
2. 正常なJCB CSVを選択
3. 「このCSVを読み込む」が有効になる
4. ボタンを押す
5. エラーなく `/` へ遷移する
6. 読み込み件数が表示される
7. `/import` に戻る
8. JCBではないCSVを選択して読み込む
9. 規定エラーが表示される
10. 正常CSVを再度読み込める
11. NetworkタブでCSVファイル自体がServerへ送信されていないことを確認する

---

## 27. Quality Gate

Spec 02完了前に以下を実行します。

```bash
npm run lint
npm run build
```

テストscriptを追加した場合：

```bash
npm test
```

またはプロジェクトで定義した同等コマンド。

すべてのVerification結果をCodex完了報告へ記載します。

未確認のAcceptance CriteriaをPASS扱いしてはいけません。

---

## 28. Implementation Constraints

Codexは以下を守ること。

1. `PROJECT_SPEC.md` を上位仕様として扱う
2. 本Specのみを実装する
3. Spec 03以降を先回りしない
4. JCB CSVをServerへアップロードしない
5. AI分類を実装しない
6. Dashboardグラフを作らない
7. localStorageへTransactionを保存しない
8. 不要な抽象化を作らない
9. 将来用Dependencyを追加しない
10. Parent Specとの矛盾を発見した場合、勝手に仕様変更せず報告する
11. 仕様書を実装都合で勝手に書き換えない

---

## 29. Handoff to Spec 03

Spec 02完了時点：

```text
JCB CSV
   ↓
ParsedTransaction[]
```

まで完成していること。

Spec 03では：

```text
ParsedTransaction[]
   ↓
merchantNormalized
   ↓
Category Cache lookup
   ↓
Unknown merchants
   ↓
POST /api/classify
   ↓
OpenAI Structured Output
   ↓
Category assignment
   ↓
Categorized Transaction[]
```

へ拡張します。

Spec 02ではこのAI分類フローを実装してはいけません。

---

## 30. Definition of Done

以下をすべて満たしたときSpec 02を完了とします。

- JCB CSVをブラウザ内で読み取れる
- 対象JCBセクションのみ解析できる
- `ParsedTransaction[]` を生成できる
- 日付・金額・店名が仕様どおり変換される
- 個人識別性の高い不要データを保存しない
- 不正CSVを安全にエラー扱いできる
- CSVをServerへ送信しない
- 正常解析後にDashboardへ遷移する
- 解析結果を一時クライアント状態で保持できる
- Spec 03以降を実装していない
- Parserテストが通る
- lintが通る
- buildが通る
- Acceptance Criteriaがすべて確認済み
