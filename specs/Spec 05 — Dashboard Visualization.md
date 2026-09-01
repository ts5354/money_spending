# Spec 05 --- Dashboard Visualization

## Status

READY FOR PLANNING

## 1. Purpose

Spec 01〜04で構築したCSV Import、JCB CSV Parsing、AI Category
Classification、 Category Cache、Manual Correctionを利用し、読み込まれた
`Transaction[]` を Dashboard上で視覚的に把握できるようにする。

Spec 05では以下を実装する。

-   合計支出
-   対象期間
-   カテゴリ別支出
-   カテゴリ構成比
-   日別支出推移
-   Dashboard用集計ロジック
-   ResponsiveなDashboard UI
-   Spec 04 Manual Correctionとの即時連動

Spec 05ではTransaction
Explorer、検索、フィルタ、カテゴリクリック遷移などは実装しない。
それらはSpec 06以降の責務とする。

------------------------------------------------------------------------

## 2. Input

DashboardのSource of TruthはTransaction Contextが保持する
`Transaction[] | null` とする。

既存Transaction型を変更しない。

``` ts
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

Dashboard集計のためにCSVを再解析してはいけない。

Dashboard Componentから `/api/classify`
やOpenAIを直接呼び出してはいけない。

------------------------------------------------------------------------

## 3. Dashboard Contents

Transactionが読み込まれている場合、Dashboardには以下を表示する。

1.  合計支出
2.  対象期間
3.  カテゴリ別支出 Horizontal Bar Chart
4.  カテゴリ構成比 Donut Chart
5.  日別支出推移 Line Chart
6.  Spec 04で実装済みのManual Category Correction UI

基本構成:

``` text
Dashboard
│
├─ Total Spending Card
│   ├─ 合計支出
│   └─ 対象期間
│
├─ Category Spending
│   └─ Horizontal Bar Chart
│
├─ Category Distribution
│   └─ Donut Chart + Legend
│
├─ Daily Spending Trend
│   └─ Line Chart
│
└─ Manual Category Correction
```

------------------------------------------------------------------------

## 4. Dashboard Aggregation Boundary

集計処理をReact Componentへ直接埋め込まない。

`Transaction[]` からDashboard表示用データを生成するpure
functionを用意する。

想定:

``` text
src/lib/dashboard/
├─ aggregate-dashboard.ts
└─ dashboard-types.ts
```

実際のファイル構成は既存コードを調査した上で決定してよい。

概念的な型:

``` ts
type CategorySummary = {
  category: Category;
  amount: number;
  percentage: number;
};

type DailySummary = {
  date: string;
  amount: number;
};

type DashboardSummary = {
  totalAmount: number;
  startDate: string | null;
  endDate: string | null;
  categorySummaries: CategorySummary[];
  dailySummaries: DailySummary[];
};
```

集計ロジックはUIから独立して自動テスト可能であること。

------------------------------------------------------------------------

## 5. Total Spending

合計支出は全Transactionの `amount` の合計とする。

``` ts
totalAmount = sum(transaction.amount)
```

Dashboardでは日本円として表示する。

例:

``` text
合計支出
¥104,407
```

要件:

-   日本円として表示する
-   小数部分は表示しない
-   3桁区切りを使用する
-   特定の金額をhard-codeしない

------------------------------------------------------------------------

## 6. Target Period

Dashboardに対象期間を表示する。

CSVヘッダの対象期間を新たにstateへ追加するのではなく、 現在の
`Transaction[]` の日付から算出する。

-   `startDate` = 最古Transactionの日付
-   `endDate` = 最新Transactionの日付

例:

``` text
2026/07/16 - 2026/08/15
```

Transactionの配列順に依存してはいけない。

「今月の支出」という表現は使用しない。 JCB
CSVの対象期間が暦月とは限らないためである。

------------------------------------------------------------------------

## 7. Category Spending Aggregation

固定9CategoryごとにTransaction amountを集計する。

要件:

-   同一CategoryのTransaction amountを合算する
-   支出額が0のCategoryはChart用summaryから除外する
-   Category summaryは支出額の大きい順に並べる
-   Category summaryの合計は `totalAmount` と一致する
-   Category表示名には既存の `CATEGORY_LABELS` を利用する
-   Categoryを新規追加・変更しない

------------------------------------------------------------------------

## 8. Category Percentage

各Categoryの構成比を計算する。

``` ts
percentage = categoryAmount / totalAmount * 100
```

要件:

-   内部値は表示のために事前丸めしない
-   UI表示時のみ丸める
-   表示は原則小数1桁
-   `totalAmount === 0` の場合にdivision by zeroやNaNを発生させない

------------------------------------------------------------------------

## 9. Category Spending Bar Chart

カテゴリ別支出をHorizontal Bar Chartで表示する。

要件:

-   支出額降順
-   0円Categoryは表示しない
-   Category Labelを表示する
-   金額を日本円として理解できる表示にする
-   Responsive Containerを使用する
-   固定pixel幅だけに依存しない

Tooltipには最低限以下を表示する。

-   Category Label
-   Amount

------------------------------------------------------------------------

## 10. Category Distribution Donut Chart

Category構成比をDonut Chartで表示する。

同じ `categorySummaries` をBar Chartと共有する。

要件:

-   Categoryごとの構成比を視覚化する
-   0円Categoryは表示しない
-   Donut中央に合計支出を表示してよい
-   Chart外または隣接領域にLegendを表示する
-   LegendにはCategory Labelとpercentageを表示する
-   percentageは原則小数1桁表示
-   Responsiveであること
-   9CategoryすべてのラベルをDonut上へ直接描画して可読性を落とさない

Tooltipには最低限以下を表示する。

-   Category Label
-   Amount
-   Percentage

------------------------------------------------------------------------

## 11. Daily Spending Aggregation

Transactionを `date` 単位で集計する。

同一日に複数Transactionがある場合はamountを合算する。

期間内のTransactionがない日を0円で補完する。

例:

``` text
2026/08/01  1000
2026/08/02     0
2026/08/03  2000
```

要件:

-   `startDate` から `endDate` まで全日を生成する
-   Transactionがない日は `amount: 0`
-   日付昇順に並べる
-   同日のTransactionを合算する
-   `dailySummaries` のamount合計は `totalAmount` と一致する
-   日付処理でユーザーTimezoneによる意図しない前日/翌日ずれを起こさない
-   JCBの日付はcalendar
    dateとして扱い、UTC変換によって日付を変化させない

------------------------------------------------------------------------

## 12. Daily Spending Line Chart

日別支出推移をLine Chartで表示する。

要件:

-   X軸 = date
-   Y軸 = amount
-   Transactionがない日も0円として表示
-   日付昇順
-   Responsive Containerを使用
-   mobileでも横方向に破綻しない
-   過剰なaxis labelで可読性を損なわない

Tooltipには最低限以下を表示する。

-   Date
-   Amount

------------------------------------------------------------------------

## 13. Chart Library

Spec 05ではChart Libraryとして `recharts` を使用する。

必要な場合、dependencyへ追加してよい。

想定利用Component:

-   `ResponsiveContainer`
-   `BarChart`
-   `Bar`
-   `PieChart`
-   `Pie`
-   `Cell`
-   `LineChart`
-   `Line`
-   `XAxis`
-   `YAxis`
-   `Tooltip`

必要最小限のComponentのみ利用する。

自前で複雑なSVG Chart Engineを実装しない。

------------------------------------------------------------------------

## 14. Category Visual Identity

同じCategoryはBar Chart、Donut
Chart、Legend等で一貫した視覚表現を使用する。

Categoryごとの色定義が必要な場合は一箇所へ集約し、
Componentごとに同じCategoryの色を別々にhard-codeしない。

色は可読性を優先し、白背景上で識別可能であること。

Categoryの意味を色だけに依存させず、Category Labelも併記する。

------------------------------------------------------------------------

## 15. Dashboard UI

既存方針であるMoneyForward風の、 白・明るい背景を基調としたCard-based
Dashboardを維持する。

Desktop:

``` text
┌─────────────────────────────────────────┐
│ Dashboard                               │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 合計支出                            │ │
│ │ ¥104,407                            │ │
│ │ 2026/07/16 - 2026/08/15             │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌──────────────────┐ ┌────────────────┐ │
│ │ カテゴリ別支出   │ │ カテゴリ構成比 │ │
│ │ Bar Chart        │ │ Donut Chart    │ │
│ └──────────────────┘ └────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 日別支出推移                        │ │
│ │ Line Chart                          │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ 利用先のカテゴリを修正             │ │
│ │ Spec 04 Manual Correction UI        │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

Mobileでは原則縦配置とする。

``` text
Total Card
↓
Category Bar
↓
Donut
↓
Daily Line
↓
Manual Correction
```

横スクロールを前提としたDashboardにしない。

------------------------------------------------------------------------

## 16. Empty State

Transaction Contextが `null` の場合、既存Dashboard Empty
Stateを維持する。

`aggregateDashboard([])` も安全に処理できること。

空配列に対して:

-   totalAmount = 0
-   startDate = null
-   endDate = null
-   categorySummaries = \[\]
-   dailySummaries = \[\]

とし、crashしない。

------------------------------------------------------------------------

## 17. Manual Correction Integration

Spec 04のManual Correctionを維持する。

Manual CorrectionによってTransaction Contextが更新された場合、
Dashboard集計も同じ最新 `Transaction[]` から再計算されること。

Category変更によって即時更新されるもの:

-   Category Bar Chart
-   Category Donut Chart
-   Category Legend / Percentage

Category変更によって変化してはいけないもの:

-   totalAmount
-   startDate
-   endDate
-   dailySummaries
-   Daily Line Chart

Manual CorrectionのCache永続化仕様はSpec 04のまま維持する。

------------------------------------------------------------------------

## 18. Category Click Behavior

Spec 05ではCategory ChartのclickによるTransaction一覧遷移を実装しない。

以下はSpec 06の責務とする。

``` text
Category click
 ↓
/transactions?category=restaurant
```

Spec 05ではBar/Donutを表示専用として扱う。

------------------------------------------------------------------------

## 19. Privacy / Security Boundary

Spec 03/04のPrivacy Boundaryを変更しない。

Dashboard集計はBrowser内の既存 `Transaction[]` のみを使用する。

Dashboard表示のために新しいServer APIを追加しない。

Dashboardから以下を外部送信しない。

-   Transaction\[\]
-   amount
-   date
-   description
-   approvalNumber
-   Category Cache
-   DashboardSummary

`OPENAI_API_KEY` のServer-only境界を変更しない。

`/api/classify` のcontractを変更しない。

------------------------------------------------------------------------

## 20. Out of Scope

Spec 05では以下を実装しない。

-   Transaction Explorer
-   Transaction検索
-   Date filter
-   Category filter
-   Category click navigation
-   Monthly comparison
-   Previous-period comparison
-   Budget
-   Spending judgment
-   「浪費」判定
-   Category追加・削除
-   Category名称変更
-   Category Cache管理画面
-   Cache reset UI
-   AI再分類UI
-   Database
-   Authentication
-   Cloud sync
-   MyJCB automatic acquisition
-   Discord integration
-   AI spending summary
-   PWA
-   Production test flags
-   Artificial delays
-   Debug backdoors

------------------------------------------------------------------------

# Acceptance Criteria

## Total / Period

**AC01** `Transaction[]` から `totalAmount` を正しく計算できる。\
**AC02** 合計支出を日本円・整数・3桁区切りで表示する。\
**AC03** 最古Transactionの日付を `startDate` とする。\
**AC04** 最新Transactionの日付を `endDate` とする。\
**AC05** Dashboardに対象期間を表示する。\
**AC06** 「今月の支出」という暦月を前提とした表現を使用しない。

## Category Aggregation

**AC07** Categoryごとの支出額を正しく集計できる。\
**AC08** Category集計に既存の固定9Categoryのみを使用する。\
**AC09** Category summaryのamount合計が `totalAmount` と一致する。\
**AC10** 支出0円CategoryをChart用summaryから除外する。\
**AC11** Category summaryを支出額降順に並べる。\
**AC12** Category Labelに既存 `CATEGORY_LABELS` を利用する。

## Category Percentage

**AC13** Category percentageを `categoryAmount / totalAmount * 100`
で計算する。\
**AC14** Percentageの内部値を表示前に不要に丸めない。\
**AC15** Percentageを原則小数1桁で表示する。\
**AC16** `totalAmount === 0` でもNaN/Infinity/crashを発生させない。

## Daily Aggregation

**AC17** 日付ごとの支出額を正しく集計できる。\
**AC18** 同日の複数Transactionを合算する。\
**AC19** Transactionが存在しない日を0円で補完する。\
**AC20** `dailySummaries` を日付昇順にする。\
**AC21** `dailySummaries` のamount合計が `totalAmount` と一致する。\
**AC22** Calendar date処理によってTimezone由来の日付ずれを発生させない。

## Charts

**AC23** Category Spending Horizontal Bar Chartを表示する。\
**AC24** Category Distribution Donut Chartを表示する。\
**AC25** Daily Spending Line Chartを表示する。\
**AC26** 3種類のChartがResponsive Container内で表示される。\
**AC27** Bar Chart TooltipにCategory LabelとAmountを表示する。\
**AC28** Donut Chart TooltipにCategory
Label、Amount、Percentageを表示する。\
**AC29** Line Chart TooltipにDateとAmountを表示する。\
**AC30** Donut LegendにCategory LabelとPercentageを表示する。\
**AC31** 同一Categoryの視覚表現をChart間で一貫させる。\
**AC32** Categoryの意味を色だけに依存させない。

## Dashboard UI

**AC33** 合計支出Cardを表示する。\
**AC34** DesktopでCategory BarとDonutを読みやすく配置する。\
**AC35** Daily Line Chartを独立したCardとして表示する。\
**AC36** MobileではDashboard主要Cardを縦方向に配置する。\
**AC37** Dashboard全体が不要な横スクロールを要求しない。

## Empty State

**AC38** Transaction Contextが `null` の場合、既存Empty
Stateを表示する。\
**AC39** `aggregateDashboard([])` がクラッシュしない。\
**AC40** 空配列ではtotalAmount 0、期間null、Category/Daily
summary空を返す。

## Manual Correction Integration

**AC41** Spec 04のManual Correction UIを維持する。\
**AC42** Manual Correction後、Category Bar Chartが即時更新される。\
**AC43** Manual Correction後、Donut ChartとLegendが即時更新される。\
**AC44** Manual Correction後も `totalAmount` は変化しない。\
**AC45** Manual Correction後も対象期間は変化しない。\
**AC46** Manual Correction後もDaily aggregation / Line
Chartは変化しない。\
**AC47** Spec 04のCategory Cache永続化挙動を変更しない。

## Architecture / Privacy

**AC48** Dashboard集計をpure functionとしてUIから分離する。\
**AC49** Dashboard表示のための新しいServer APIを追加しない。\
**AC50** DashboardからTransactionやDashboardSummaryを外部送信しない。\
**AC51** `/api/classify` のcontractを変更しない。\
**AC52** `OPENAI_API_KEY` のServer-only境界を維持する。

## Scope Protection

**AC53** Category clickによるTransaction一覧遷移をSpec
05では実装しない。\
**AC54** Transaction検索・Date filter・Category filterを実装しない。\
**AC55** Monthly comparisonやBudget機能を実装しない。\
**AC56** DB/Authを追加しない。\
**AC57** Production test flag、artificial delay、debug
backdoorを追加しない。

## Verification

**AC58** Dashboard aggregationの自動テストを追加する。\
**AC59** 0日補完、同日集計、Category降順、percentage、empty
inputを自動テストする。\
**AC60** Spec 01〜04の既存テストにRegressionがない。\
**AC61** `npm test` がPASSする。\
**AC62** `npm run lint` がPASSする。\
**AC63** `npx tsc --noEmit` がPASSする。\
**AC64** `npm run build` がPASSする。\
**AC65** 実ブラウザでTotal Card、Bar、Donut、Lineの表示を確認する。\
**AC66** 実ブラウザでManual CorrectionによるCategory
Chart即時更新を確認する。\
**AC67** 実ブラウザでDesktop layoutを確認する。\
**AC68** 実ブラウザでMobile layoutを確認する。\
**AC69** `.env.local` および実API Keyをcommitしない。

------------------------------------------------------------------------

# Definition of Done

Spec 05 is COMPLETE when:

1.  AC01〜AC69をすべて確認できる。
2.  Transaction ContextからDashboardSummaryを正しく生成できる。
3.  Total、Category、Dailyの3種類の集計が正しい。
4.  Bar、Donut、Lineの3種類のChartが正常表示される。
5.  Transactionがない日が0円としてDaily Chartへ補完される。
6.  Manual CorrectionがCategory Chartへ即時反映される。
7.  Manual CorrectionによってTotal/Dailyの値が変化しない。
8.  Spec 01〜04にRegressionがない。
9.  Spec 03/04のPrivacy Boundaryを維持する。
10. Automated tests / lint / typecheck / buildがPASSする。
11. Desktop / Mobileの実ブラウザ表示を確認する。
12. Review完了前にcommit/pushしない。
