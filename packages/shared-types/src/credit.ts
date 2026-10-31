export type CreditTransactionType =
  | "grant"
  | "purchase"
  | "spend"
  | "refund"
  | "adjustment";

export type CreditTransactionStatus = "pending" | "completed" | "failed" | "reversed";

export interface CreditTransaction {
  id: string;
  userId: string;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  status: CreditTransactionStatus;
  referenceType: string | null;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

export interface CreditBalance {
  userId: string;
  balance: number;
  updatedAt: string;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  isActive: boolean;
}

export interface AutoRefillSettings {
  enabled: boolean;
  threshold: number;
  amount: number;
  packageId?: string | null;
  updatedAt?: string;
}

export type CreditAutoRefillSettings = AutoRefillSettings;
export type AutoRefillConfig = AutoRefillSettings;
