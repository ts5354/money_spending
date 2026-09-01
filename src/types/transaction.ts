export type ParsedTransaction = {
  id: string;
  date: string;
  merchantRaw: string;
  merchantNormalized: string;
  amount: number;
  description: string | null;
  approvalNumber: string | null;
};
