export const transactionTypes = ["income", "expense"] as const;

export type TransactionType = (typeof transactionTypes)[number];

export const paymentMethods = [
  "cash",
  "debit_card",
  "credit_card",
  "bank_transfer",
  "digital_wallet",
  "other"
] as const;

export type PaymentMethod = (typeof paymentMethods)[number];

export interface FinancialTransaction {
  id: string;
  type: TransactionType;
  date: string;
  amount: number;
  category: TransactionCategoryKey;
  description: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const incomeCategoryKeys = [
  "salary",
  "additional_income",
  "sale",
  "refund",
  "interest",
  "gift",
  "other_income"
] as const;

export const expenseCategoryKeys = [
  "rent",
  "utilities",
  "groceries",
  "transport",
  "health",
  "education",
  "entertainment",
  "clothing",
  "taxes",
  "debts",
  "maintenance",
  "pets",
  "other_expense"
] as const;

export type IncomeCategoryKey = (typeof incomeCategoryKeys)[number];
export type ExpenseCategoryKey = (typeof expenseCategoryKeys)[number];
export type TransactionCategoryKey = IncomeCategoryKey | ExpenseCategoryKey;
