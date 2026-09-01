import type { Category } from "@/types/category";

export type ParsedTransaction = {
  id: string;
  date: string;
  merchantRaw: string;
  merchantNormalized: string;
  amount: number;
  description: string | null;
  approvalNumber: string | null;
};

export type Transaction = ParsedTransaction & {
  category: Category;
  categorySource: "ai" | "cache" | "manual";
};
