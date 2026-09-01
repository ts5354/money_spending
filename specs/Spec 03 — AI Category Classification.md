# Spec 03 — AI Category Classification

## 1. Purpose

Spec 02で生成した `ParsedTransaction[]` に対し、店舗名のみをOpenAI APIへ送信して固定カテゴリを判定し、カテゴリ付きの `Transaction[]` を生成する。

本SpecではAI分類のみを実装する。

以下は実装しない。

- Category Cache
- localStorageへのカテゴリ保存
- Manual Category Correction
- Dashboardグラフ
- カテゴリ別集計
- Transaction Explorerのフィルタ拡張
- CSV永続化
- Database
- Authentication
- MyJCB自動取得
- Discord連携

これらは後続Specで扱う。

---

# 2. Category Definition

利用可能なカテゴリは以下の8種類に固定する。

```ts
export const CATEGORY_IDS = [
  "convenience_store",
  "supermarket",
  "vending_machine",
  "restaurant",
  "subscription",
  "shopping",
  "transportation",
  "entertainment",
  "other",
] as const;

export type Category = (typeof CATEGORY_IDS)[number];
```

表示名：

```ts
export const CATEGORY_LABELS: Record<Category, string> = {
  convenience_store: "コンビニ",
  supermarket: "スーパー",
  vending_machine: "自販機",
  restaurant: "飲食",
  subscription: "サブスク",
  shopping: "買い物",
  transportation: "交通",
  entertainment: "娯楽",
  other: "その他",
};
```

AIは上記以外のカテゴリを生成してはならない。

---

# 3. Transaction Type

Spec 02で定義した以下を入力として使用する。

```ts
type ParsedTransaction = {
  id: string;
  date: string;
  merchantRaw: string;
  merchantNormalized: string;
  amount: number;
  description: string | null;
  approvalNumber: string | null;
};
```

Spec 03完了後は以下へ変換する。

```ts
type Transaction = {
  id: string;
  date: string;
  merchantRaw: string;
  merchantNormalized: string;
  amount: number;
  category: Category;
  categorySource: "ai" | "cache" | "manual";
  description: string | null;
  approvalNumber: string | null;
};
```

Spec 03では生成されるTransactionの `categorySource` は常に：

```ts
"ai"
```

とする。

`cache` と `manual` は後続Specで使用する。

---

# 4. Classification Input

ブラウザは `ParsedTransaction[]` から `merchantNormalized` のみを抽出する。

重複した店舗名は削除する。

例：

```ts
[
  { merchantNormalized: "セブンイレブン", ... },
  { merchantNormalized: "セブンイレブン", ... },
  { merchantNormalized: "Netflix", ... },
]
```

APIへ送信する値：

```json
{
  "merchants": [
    "セブンイレブン",
    "Netflix"
  ]
}
```

同一店舗を複数回OpenAIへ送信してはならない。

---

# 5. Privacy Requirements

OpenAIへ送信してよいデータは：

```text
merchantNormalized
```

のみとする。

以下をOpenAIへ送信してはならない。

- CSVファイル
- CSV全文
- ParsedTransactionオブジェクト
- Transactionオブジェクト
- amount
- date
- approvalNumber
- description
- ご利用者番号
- その他のJCB明細情報

Serverログにも以下を出力してはならない。

- merchant一覧
- CSV内容
- Transaction
- approvalNumber
- 個人利用情報

エラー時にも入力店舗名をProduction logへ出力しない。

---

# 6. API Architecture

BrowserからOpenAI APIを直接呼び出してはならない。

以下の経路を使用する。

```text
Browser
  ↓
POST /api/classify
  ↓
Next.js Route Handler
  ↓
OpenAI Responses API
```

実装場所：

```text
src/app/api/classify/route.ts
```

OpenAI API KeyはServer Side環境変数のみで使用する。

```text
OPENAI_API_KEY
```

以下は禁止：

```text
NEXT_PUBLIC_OPENAI_API_KEY
```

API KeyをClient Bundleへ含めてはならない。

---

# 7. OpenAI SDK

公式OpenAI Node.js SDKを使用する。

Dependency：

```text
openai
```

Responses APIを使用する。

Chat Completions APIへ変更しない。

---

# 8. Model Configuration

モデル名をClientから受け取ってはならない。

Server側でのみ決定する。

環境変数：

```text
OPENAI_MODEL
```

を利用可能とする。

未設定時のデフォルトモデルは：

```text
gpt-5.6-luna
```

とする。

店舗名の固定カテゴリ分類という軽量タスクであるため、コストを抑えることを優先する。

---

# 9. OpenAI Request

Responses APIを使用する。

概念上、以下に相当するRequestとする。

```ts
await client.responses.create({
  model,
  store: false,
  instructions: CLASSIFICATION_INSTRUCTIONS,
  input: JSON.stringify({
    merchants,
  }),
  text: {
    format: {
      type: "json_schema",
      name: "merchant_categories",
      strict: true,
      schema: ...
    },
  },
});
```

実際のSDK型定義・API仕様に適合する形で実装すること。

---

# 10. Classification Instructions

AIには以下の目的を明示する。

```text
あなたは日本のクレジットカード利用明細に表示される店舗名を分類します。

各merchantを、必ず指定されたカテゴリのいずれか1つに分類してください。

利用可能なカテゴリ：

convenience_store
supermarket
vending_machine
restaurant
subscription
shopping
transportation
entertainment
other

店舗名だけから判断してください。

不明確な場合、推測で新しいカテゴリを作らず other を使用してください。

同じmerchant文字列を変更・要約・翻訳しないでください。
入力されたmerchant文字列をそのまま返してください。

支出が良い・悪い・無駄かどうかを判断してはいけません。
```

---

# 11. Structured Output

OpenAIの出力はStructured Outputsを使用する。

概念上のJSON Schema：

```json
{
  "type": "object",
  "properties": {
    "classifications": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "merchant": {
            "type": "string"
          },
          "category": {
            "type": "string",
            "enum": [
              "convenience_store",
              "supermarket",
              "vending_machine",
              "restaurant",
              "subscription",
              "shopping",
              "transportation",
              "entertainment",
              "other"
            ]
          }
        },
        "required": [
          "merchant",
          "category"
        ],
        "additionalProperties": false
      }
    }
  },
  "required": [
    "classifications"
  ],
  "additionalProperties": false
}
```

`strict: true` を使用する。

---

# 12. Server Validation

OpenAI Structured Outputsだけに依存してはならない。

Server側でも入力・出力を検証する。

## Input

Request body：

```ts
type ClassifyRequest = {
  merchants: string[];
};
```

以下を拒否する。

- JSONでない
- `merchants` が存在しない
- Arrayでない
- 空配列
- string以外を含む
- 空文字列を含む
- 過剰に長い店舗名
- 過剰な件数

上限：

```text
merchant count: 100
merchant length: 200 characters
```

重複が含まれていた場合、Server側でもdeduplicateしてよい。

---

# 13. Server Response

正常：

```json
{
  "classifications": [
    {
      "merchant": "セブンイレブン",
      "category": "convenience_store"
    },
    {
      "merchant": "Netflix",
      "category": "subscription"
    }
  ]
}
```

ClientへOpenAI Responseオブジェクトそのものを返してはならない。

必要な分類結果のみ返す。

---

# 14. Output Integrity

Serverは以下を確認する。

OpenAIから返されたmerchantが：

```text
requestに存在するmerchant
```

であること。

さらに、Requestに含まれる全merchantについて分類結果が1件ずつ存在すること。

以下はエラーとする。

- unknown merchant
- missing merchant
- duplicated result
- invalid category

OpenAIが入力に存在しないmerchantを生成した場合、その結果を採用してはならない。

---

# 15. API Errors

Clientが扱えるエラーを定義する。

```ts
type ClassificationErrorCode =
  | "INVALID_REQUEST"
  | "CLASSIFICATION_FAILED";
```

## INVALID_REQUEST

Client Requestが不正。

HTTP：

```text
400
```

## CLASSIFICATION_FAILED

以下を含む。

- OpenAI API failure
- Structured Output failure
- 不完全なclassification
- Output integrity failure
- Server configuration failure

HTTP：

```text
500
```

ClientへOpenAI API内部エラーやAPI Key情報を露出してはならない。

---

# 16. Client Classification Flow

CSV解析成功後：

```text
ParsedTransaction[]
        ↓
unique merchantNormalized[]
        ↓
POST /api/classify
        ↓
classification map
        ↓
Transaction[]
        ↓
Context更新
        ↓
Dashboardへ遷移
```

Spec 02で現在、

```text
parse成功
→ ParsedTransaction[]をContextへ保存
→ /
```

となっている処理を、

```text
parse成功
→ AI classification
→ Transaction[]をContextへ保存
→ /
```

へ変更する。

---

# 17. UI Loading State

AI分類中はImport画面で処理中状態を表示する。

例：

```text
CSVを解析しています...
```

↓

```text
利用先を分類しています...
```

厳密な文言は既存UIデザインに合わせてよい。

分類処理中はImport操作を二重実行できないこと。

---

# 18. Classification Failure UI

AI分類に失敗した場合：

- Dashboardへ遷移しない
- 読み込んだTransactionを確定状態として保存しない
- Import画面にエラー表示する
- 再試行可能な状態へ戻す

表示例：

```text
利用先の分類に失敗しました。
もう一度お試しください。
```

OpenAI内部エラーをそのまま表示してはならない。

---

# 19. Client State

Spec 03完了後、Transaction Contextは：

```ts
Transaction[] | null
```

を保持する。

`ParsedTransaction[]` をアプリ全体の最終stateとして保持し続けない。

ただしCSV Parser自身の戻り値は引き続き：

```ts
ParsedTransaction[]
```

とする。

---

# 20. No Cache Yet

Spec 03ではAI分類結果をlocalStorageへ保存してはならない。

CSVを再読み込みした場合、同じ店舗であっても再度AI分類されてよい。

Category CacheはSpec 04で実装する。

---

# 21. No Manual Correction Yet

カテゴリの手動変更UIを実装してはならない。

Spec 04で実装する。

---

# 22. Dashboard Scope

DashboardはSpec 03ではカテゴリ付きTransactionを受け取れる状態にするだけでよい。

以下はまだ実装しない。

- 円グラフ
- 棒グラフ
- 折れ線グラフ
- カテゴリ集計
- 合計支出
- カテゴリクリック

Dashboard VisualizationはSpec 05で実装する。

既存の読込件数表示は維持してよい。

---

# 23. Testing

最低限、以下を自動テストする。

### Server validation

1. valid merchant array
2. missing merchants
3. merchants is not array
4. empty array
5. non-string merchant
6. empty merchant
7. merchant count > 100
8. merchant length > 200

### Classification output

9. valid classifications
10. invalid category rejected
11. missing merchant rejected
12. unknown merchant rejected
13. duplicate classification rejected

### Client transformation

14. duplicate merchants are sent only once
15. classifications map back to all matching ParsedTransactions
16. `categorySource === "ai"`
17. original transaction fields remain unchanged

### Privacy

18. API request body contains merchant strings only
19. amount/date/approvalNumber/description are not sent

Tests must use架空の店舗名・架空のTransactionのみを使用する。

実JCBデータをFixtureへ含めない。

OpenAI APIへ実際のNetwork Requestを行う自動テストを必須にしない。

OpenAI Clientはmock可能な境界に分離する。

---

# 24. Environment Variables

ローカル：

```text
.env.local
```

に：

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.6-luna
```

を設定できる。

`.env.local` はGit管理しない。

`.env.example` を追加する場合：

```text
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-luna
```

とし、実API Keyを含めてはならない。

---

# 25. Security Requirements

以下を禁止する。

- ClientからOpenAIへ直接Request
- Client BundleへのAPI Key埋め込み
- `NEXT_PUBLIC_OPENAI_API_KEY`
- Request bodyからmodelを指定
- Arbitrary promptをClientからServerへ送信
- Clientからsystem/developer instructionを指定
- OpenAI raw responseをClientへ返却
- API Keyをlogへ出力

`/api/classify` は固定された分類用途にのみ使用する。

---

# 26. Known Limitation

MVPはAuthenticationを持たないため、公開Deployment上の `/api/classify` に完全な利用者認証は存在しない。

本SpecではAuthenticationやDatabaseを追加しない。

その代わり：

- Request size制限
- merchant count制限
- merchant length制限
- 固定prompt
- 固定model/server-controlled model

によってAPIの用途を限定する。

本格的なアクセス制御は将来Specの対象とする。

---

# 27. Dependencies

追加可能：

```text
openai
```

必要以上のValidation libraryを新規導入しない。

現在の実装規模で単純なTypeScript validationが十分なら、それを優先する。

---

# 28. Quality Gates

実装完了時：

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```

を確認する。

Codex Sandboxの制約により標準buildが失敗する場合、その事実を報告し、Project設定を変更して回避してはならない。

ローカルMacで標準 `npm run build` を最終確認する。

---

# 29. Acceptance Criteria

## API / Architecture

**AC-01**  
公式 `openai` SDKが導入されている。

**AC-02**  
OpenAI呼び出しがNext.js Server側のみで行われる。

**AC-03**  
`OPENAI_API_KEY` がServer Sideのみで使用される。

**AC-04**  
Client BundleにAPI Keyが含まれない。

**AC-05**  
Responses APIが使用されている。

**AC-06**  
Structured Outputs / JSON Schema / `strict: true` が使用されている。

**AC-07**  
OpenAI Requestで `store: false` が指定されている。

---

## Category

**AC-08**  
固定9カテゴリのみが定義されている。

**AC-09**  
AIが定義外カテゴリを返した場合、その結果を受理しない。

**AC-10**  
不明な店舗は `other` を利用可能である。

---

## Privacy

**AC-11**  
OpenAIへ送信されるTransaction由来情報は `merchantNormalized` のみである。

**AC-12**  
amountがOpenAIへ送信されない。

**AC-13**  
dateがOpenAIへ送信されない。

**AC-14**  
approvalNumberがOpenAIへ送信されない。

**AC-15**  
descriptionがOpenAIへ送信されない。

**AC-16**  
CSV全文がServer/OpenAIへ送信されない。

**AC-17**  
機密Transaction情報をProduction logへ出力しない。

---

## Request / Validation

**AC-18**  
Clientは重複したmerchantNormalizedをdeduplicateして送信する。

**AC-19**  
ServerもRequestをValidationする。

**AC-20**  
最大100 merchants制限がある。

**AC-21**  
merchant最大200文字制限がある。

**AC-22**  
Clientからmodelやpromptを任意指定できない。

---

## Output Integrity

**AC-23**  
Server Responseはmerchantとcategoryの必要情報だけを返す。

**AC-24**  
未知merchantをOpenAIが返した場合エラーにする。

**AC-25**  
分類結果が不足している場合エラーにする。

**AC-26**  
同一merchantの重複classificationをエラーにする。

---

## Transaction Mapping

**AC-27**  
ParsedTransactionがTransactionへ変換される。

**AC-28**  
分類結果が同一merchantを持つ全Transactionへ適用される。

**AC-29**  
`categorySource` が `"ai"` になる。

**AC-30**  
date / amount / merchantRaw / merchantNormalized / description / approvalNumber / id が保持される。

---

## UI

**AC-31**  
AI分類中に処理中状態が表示される。

**AC-32**  
AI分類中に二重実行できない。

**AC-33**  
分類成功後のみDashboardへ遷移する。

**AC-34**  
分類失敗時はDashboardへ遷移しない。

**AC-35**  
分類失敗後に再試行できる。

---

## State / Scope

**AC-36**  
Transaction Contextが `Transaction[] | null` を保持する。

**AC-37**  
分類結果をlocalStorageへ保存しない。

**AC-38**  
Manual Category Correctionを実装しない。

**AC-39**  
Dashboard Visualizationを実装しない。

**AC-40**  
Spec 04以降の機能を実装しない。

---

## Testing / Quality

**AC-41**  
分類関連の自動テストが架空データのみで存在する。

**AC-42**  
OpenAI APIへの実Network Requestなしで主要ロジックをテスト可能である。

**AC-43**  
`npm test` が成功する。

**AC-44**  
`npm run lint` が成功する。

**AC-45**  
`npx tsc --noEmit` が成功する。

**AC-46**  
ローカル環境で `npm run build` が成功する。

---

# 30. Definition of Done

以下をすべて満たした場合のみSpec 03を完了とする。

- AC-01〜AC-46がPASS
- 実際のJCB CSVで分類フローが動作
- BrowserからOpenAIへの直接通信がない
- Browserから `/api/classify` へ店舗名以外のTransaction情報が送信されない
- OpenAI API KeyがClientへ露出していない
- AI分類後Dashboardへ正常遷移する
- Category Cacheはまだ実装されていない
- Manual Correctionはまだ実装されていない
- Specファイルが変更されていない
- `npm test`
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- Git statusを確認