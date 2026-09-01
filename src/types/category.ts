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

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORY_IDS.some((category) => category === value);
}
