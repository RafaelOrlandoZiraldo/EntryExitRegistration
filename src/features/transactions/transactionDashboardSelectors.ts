import {
  calculateFinancialSummary,
  groupExpensesByCategory,
  type ExpenseCategoryGroup,
  type FinancialSummary,
  type FinancialTransaction
} from "@domain/transactions";

export interface TransactionDashboardData {
  summary: FinancialSummary;
  expenseDistribution: ExpenseCategoryGroup[];
}

export function selectTransactionDashboard(
  transactions: readonly FinancialTransaction[]
): TransactionDashboardData {
  return {
    summary: calculateFinancialSummary(transactions),
    expenseDistribution: groupExpensesByCategory(transactions)
  };
}

export function createTransactionDashboardSelector() {
  let lastTransactions: readonly FinancialTransaction[] | null = null;
  let lastDashboard: TransactionDashboardData | null = null;

  return (
    transactions: readonly FinancialTransaction[]
  ): TransactionDashboardData => {
    if (transactions === lastTransactions && lastDashboard) {
      return lastDashboard;
    }

    lastTransactions = transactions;
    lastDashboard = selectTransactionDashboard(transactions);

    return lastDashboard;
  };
}
