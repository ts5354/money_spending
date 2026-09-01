# Spec 04 — Category Cache & Manual Correction

## Status
READY FOR PLANNING

## 1. Purpose
同じ利用先をCSV読み込みのたびにOpenAIへ送ることを避けるため、利用先とCategoryの対応をブラウザの `localStorage` に保存する。

また、AIによるCategory分類が誤っていた場合、ユーザーがCategoryを手動修正できるようにする。手動修正されたCategoryは以後その利用先に対して優先され、再度AI分類しない。

Spec 04ではCategory CacheとManual Correctionのみを扱う。Dashboardのグラフ・集計機能はSpec 05で実装する。

---

## 2. Fixed Categories
Spec 03で定義済みの9種類を変更しない。

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

表示ラベル:
- convenience_store: コンビニ
- supermarket: スーパー
- vending_machine: 自販機
- restaurant: 飲食
- subscription: サブスク
- shopping: 買い物
- transportation: 交通
- entertainment: 娯楽
- other: その他

Categoryの追加・削除・名称変更は行わない。

---

## 3. Category Cache
Category Cacheはブラウザの `localStorage` に保存する。

固定Storage Key:

```ts
const CATEGORY_CACHE_STORAGE_KEY =
  "jcb-spending-visualizer:category-cache:v1";
```

保存形式:

```ts
type CategoryCache = Record<string, Category>;
```

キーには `merchantNormalized` を使用する。

---

## 4. categorySource Semantics
既存のTransaction型を維持する。

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

`categorySource` は今回のTransactionがどこからCategoryを得たかを表す。

- 今回AIで分類した → `"ai"`
- 今回Category Cacheから取得した → `"cache"`
- 今回ユーザーが手動変更した → `"manual"`

`categorySource` 自体は `localStorage` に永続化しない。Category Cacheには `merchantNormalized -> Category` のみ保存する。

過去に手動修正されたmerchantであっても、次回CSV Import時にCacheから取得したTransactionは `categorySource: "cache"` となる。

---

## 5. Cache Validation
`localStorage` の内容を信用してはいけない。

読み込み時に最低限以下を検証する。

1. JSONとしてparse可能
2. objectである
3. merchant keyがstringである
4. valueが `CATEGORY_IDS` のいずれかである

不正なCategoryや不正なレコードは無視する。破損したJSONや不正なCacheによってCSV Import全体を失敗させてはいけない。Category Cacheが利用不能な場合は空Cacheとして扱えること。

---

## 6. Classification Flow

```text
JCB CSV
  ↓
ParsedTransaction[]
  ↓
unique merchantNormalized[]
  ↓
Category Cache lookup
  │
  ├─ Cache HIT → Category from localStorage → categorySource = "cache"
  │
  └─ Cache MISS → POST /api/classify → AI Classification
                   ↓
                 Save result to Category Cache
                   ↓
                 categorySource = "ai"
  ↓
Transaction[]
  ↓
Transaction Context
  ↓
Dashboard
```

---

## 7. Cached / Uncached Merchant Separation
AI Classificationの前に、uniqueな `merchantNormalized` をCache HIT / MISSへ分離する。

Cache HITしたmerchantを `/api/classify` に送信してはいけない。MISSしたmerchantのみ送信する。

---

## 8. All Merchants Cached
全unique merchantがCategory Cacheに存在する場合、`POST /api/classify` 自体を実行しない。

Category Cacheのみから `Transaction[]` を構築しDashboardへ遷移する。したがって全merchantがCachedであればOpenAI APIが利用不能でもImportは成功する。

---

## 9. AI Classification Result
未Cached merchantに対するAI Classificationが成功した場合、取得したCategoryをCategory Cacheへ保存する。

今回AIから分類されたTransactionは `categorySource: "ai"` とする。

---

## 10. AI Failure
一部がCached、一部がUncachedで、Uncached merchantのAI Classificationが失敗した場合、Import全体を失敗として扱う。

Cached分だけをDashboardに部分表示してはいけない。Transaction Contextを成功状態へ更新せず、Dashboardへ遷移しない。

エラー:
`利用先の分類に失敗しました。もう一度お試しください。`

再試行可能であること。

---

## 11. Manual Category Correction
現在読み込まれているTransactionについて、ユーザーがCategoryを手動変更できるようにする。

選択肢は固定9Categoryのみ。Category変更は即時反映する。明示的な保存ボタンは設けない。

手動変更されたTransactionは `categorySource: "manual"` となる。

---

## 12. Same Merchant Propagation
Category CorrectionはTransaction単位ではなく `merchantNormalized` 単位で反映する。

同じ `merchantNormalized` を持つ現在のTransactionすべてを選択されたCategoryへ変更し、`categorySource: "manual"` とする。

---

## 13. Manual Correction Persistence
Manual Correction時には同時にCategory Cacheを更新する。既存Cacheが存在する場合は上書きする。

次回CSV Import時にはこのmerchantをCache HITとして扱い、OpenAIへ送信しない。次回Import時はCacheから取得するため `categorySource: "cache"` となる。

---

## 14. State Responsibility
Transaction Contextは引き続き `Transaction[] | null` を管理する。

Manual Correction用に以下相当の操作を追加してよい。

```ts
updateMerchantCategory(
  merchantNormalized: string,
  category: Category
): void;
```

UI Componentが独自にTransaction stateを複製・管理する設計は避ける。Manual CorrectionはTransaction Contextの正規Stateへ反映する。

---

## 15. Suggested Module Boundaries

```text
src/lib/categories/category-cache.ts
  localStorage read/write/validation

src/lib/categories/classify-transactions.ts
  Cache HIT/MISS separation
  AI classification integration

src/state/transaction-context.tsx
  Transaction state
  Manual merchant category update

src/components/...
  Minimal manual correction UI
```

Server側 `/api/classify` はCategory Cacheを認識しない。

---

## 16. Privacy Boundary
Spec 03のPrivacy Boundaryを変更しない。

Category CacheはBrowser内だけに保存する。ServerへCategory Cache全体を送信してはいけない。

OpenAIへ送信可能なのはAI Classificationが必要な未Cachedの `merchantNormalized[]` のみ。

以下をOpenAIへ送信してはいけない。
- CSV本体
- amount
- date
- description
- approvalNumber
- user/card identifiers
- Cached merchant
- Category Cache全体

`OPENAI_API_KEY` は引き続きServer-onlyであり、Clientへ露出させない。

---

## 17. Existing /api/classify Contract
Spec 03で完成した `POST /api/classify` のServer責務を変更しない。

Client側でCache HIT/MISSを処理した後、MISSしたmerchantだけを既存APIへ送る。

Server側へlocalStorageやCacheロジックを追加しない。認証・DB・Rate LimitもSpec 04では追加しない。

---

## 18. Out of Scope
- Dashboard charts
- Spending aggregation
- Monthly comparison
- Transaction search
- Date filter
- Category filter
- Category追加・削除
- Category名称変更
- Category Cache管理画面
- Cache削除ボタン
- AI再分類ボタン
- Database
- Authentication
- Cloud sync
- MyJCB automatic acquisition
- Discord integration
- AI spending summary
- PWA
- Production test flags
- Artificial delays
- Debug backdoors

---

# Acceptance Criteria

## Cache
**AC01** Category Cacheが `localStorage` に保存される。  
**AC02** Storage Keyにversionが含まれている。  
**AC03** Cache valueとして固定9Categoryのみ許可される。  
**AC04** 壊れたJSONが存在してもアプリがクラッシュしない。  
**AC05** 不正Categoryを持つCache recordを安全に無視できる。  
**AC06** Cache済みmerchantのCategoryを取得できる。  
**AC07** 未Cached merchantを判定できる。  
**AC08** unique merchantの重複排除が維持される。  

## Classification Integration
**AC09** Cache済みmerchantを `/api/classify` に送信しない。  
**AC10** 未Cached merchantのみ `/api/classify` に送信する。  
**AC11** 全merchantがCachedの場合 `/api/classify` を呼ばない。  
**AC12** AI Classification成功結果をCategory Cacheへ保存する。  
**AC13** 今回AI分類されたTransactionは `categorySource: "ai"` になる。  
**AC14** Cacheから分類されたTransactionは `categorySource: "cache"` になる。  

## Failure Handling
**AC15** AI Classification失敗時にDashboardへ遷移しない。  
**AC16** AI失敗時にCached Transactionのみを部分表示しない。  

## Manual Correction
**AC17** Transaction Categoryを手動変更できる。  
**AC18** Manual Correctionの選択肢は固定9Categoryのみである。  
**AC19** Manual Correctionが即時Transaction Stateへ反映される。  
**AC20** Manual CorrectionされたTransactionは `categorySource: "manual"` になる。  
**AC21** 同一 `merchantNormalized` の全Transactionへ修正が反映される。  
**AC22** Manual Correction結果がCategory Cacheへ保存される。  
**AC23** Manual Correctionが既存Category Cacheを上書きする。  
**AC24** 次回Import時に手動修正済みmerchantをAIへ送信しない。  
**AC25** 次回Import時の手動修正済みmerchantは `categorySource: "cache"` になる。  

## Privacy / Architecture
**AC26** Category Cache全体をServerへ送信しない。  
**AC27** OpenAIへamount/date/description/approvalNumberを送信しない。  
**AC28** `OPENAI_API_KEY` をClientへ露出しない。  
**AC29** Spec 03の `/api/classify` Server責務を変更しない。  

## Automated Verification
**AC30** `npm test` がPASSする。  
**AC31** `npm run lint` がPASSする。  
**AC32** `npx tsc --noEmit` がPASSする。  
**AC33** `npm run build` がPASSする。  

## Browser Verification
**AC34** 初回Import時に未Cached merchantがAI分類される。  
**AC35** 同じCSVの2回目ImportでCached merchantがAIへ送信されない。  
**AC36** 全merchantがCachedならNetworkに `/api/classify` が発生しない。  
**AC37** Manual Correction後、画面上の同一merchantすべてが更新される。  
**AC38** ページ再読み込み後もCategory Cacheが残る。  
**AC39** 再Import時にManual CorrectionしたCategoryが復元される。  

## Repository Safety
**AC40** `.env.local` および実API Keyをcommitしない。

---

# Definition of Done
Spec 04 is COMPLETE when:

1. AC01–AC40をすべて確認できる。
2. Spec 01–03にRegressionがない。
3. Category CacheがClient-onlyである。
4. Manual Correctionがmerchant単位で永続化される。
5. Cached merchantが不要にOpenAIへ送信されない。
6. Automated tests / lint / typecheck / buildがPASSする。
7. 実ブラウザでCacheとManual Correctionを確認する。
8. Review完了前にcommit/pushしない。
