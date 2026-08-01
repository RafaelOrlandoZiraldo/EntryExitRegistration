import { expenseCategoryOptions } from "./catalogs";
import type {
  ExpenseCategoryKey,
  FinancialTransaction,
  TransactionCategoryKey
} from "./types";

export interface FinancialSummary {
  income: number;
  expenses: number;
  balance: number;
  transactionCount: number;
}

export interface ExpenseCategoryGroup {
  category: ExpenseCategoryKey;
  label: string;
  amount: number;
  proportion: number;
}

export function calculateIncome(transactions: readonly FinancialTransaction[]) {
  return transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);
}

export function calculateExpenses(
  transactions: readonly FinancialTransaction[]
) {
  return transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);
}

export function calculateBalance(transactions: readonly FinancialTransaction[]) {
  return calculateIncome(transactions) - calculateExpenses(transactions);
}

export function calculateFinancialSummary(
  transactions: readonly FinancialTransaction[]
): FinancialSummary {
  const income = calculateIncome(transactions);
  const expenses = calculateExpenses(transactions);

  return {
    income,
    expenses,
    balance: income - expenses,
    transactionCount: transactions.length
  };
}

export function groupExpensesByCategory(
  transactions: readonly FinancialTransaction[]
): ExpenseCategoryGroup[] {
  const expensesByCategory = new Map<TransactionCategoryKey, number>();

  for (const transaction of transactions) {
    if (transaction.type !== "expense") {
      continue;
    }

    expensesByCategory.set(
      transaction.category,
      (expensesByCategory.get(transaction.category) ?? 0) + transaction.amount
    );
  }

  const totalExpenses = calculateExpenses(transactions);

  return expenseCategoryOptions
    .filter(({ key }) => expensesByCategory.has(key))
    .map(({ key, label }) => {
      const amount = expensesByCategory.get(key) ?? 0;

      return {
        category: key,
        label,
        amount,
        proportion: totalExpenses === 0 ? 0 : amount / totalExpenses
      };
    });
}
