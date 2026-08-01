import { DomainValidationError } from "@domain/errors";
import {
  transactionFiltersSchema,
  transactionSortSchema,
  type TransactionFilters,
  type TransactionSort
} from "./schemas";
import type { FinancialTransaction } from "./types";

export interface SearchTransactionsCriteria {
  filters?: TransactionFilters;
  sort?: TransactionSort;
}

export function filterTransactions(
  transactions: readonly FinancialTransaction[],
  filters: TransactionFilters = {}
) {
  const parsedFilters = parseOrThrow(() =>
    transactionFiltersSchema.parse(filters)
  );
  const text = parsedFilters.text?.toLocaleLowerCase();

  return transactions.filter((transaction) => {
    const notes = transaction.notes ?? "";

    return (
      (parsedFilters.dateFrom === undefined ||
        transaction.date >= parsedFilters.dateFrom) &&
      (parsedFilters.dateTo === undefined ||
        transaction.date <= parsedFilters.dateTo) &&
      (parsedFilters.type === undefined ||
        transaction.type === parsedFilters.type) &&
      (parsedFilters.category === undefined ||
        transaction.category === parsedFilters.category) &&
      (parsedFilters.paymentMethod === undefined ||
        transaction.paymentMethod === parsedFilters.paymentMethod) &&
      (parsedFilters.amountMin === undefined ||
        transaction.amount >= parsedFilters.amountMin) &&
      (parsedFilters.amountMax === undefined ||
        transaction.amount <= parsedFilters.amountMax) &&
      (text === undefined ||
        `${transaction.description} ${notes}`.toLocaleLowerCase().includes(text))
    );
  });
}

export function sortTransactions(
  transactions: readonly FinancialTransaction[],
  sort: TransactionSort = { field: "date", direction: "desc" }
) {
  const parsedSort = parseOrThrow(() => transactionSortSchema.parse(sort));
  const multiplier = parsedSort.direction === "asc" ? 1 : -1;

  return [...transactions].sort((first, second) => {
    const firstValue = first[parsedSort.field];
    const secondValue = second[parsedSort.field];

    if (firstValue < secondValue) {
      return -1 * multiplier;
    }

    if (firstValue > secondValue) {
      return 1 * multiplier;
    }

    return first.id.localeCompare(second.id);
  });
}

export function searchTransactions(
  transactions: readonly FinancialTransaction[],
  criteria: SearchTransactionsCriteria = {}
) {
  return sortTransactions(
    filterTransactions(transactions, criteria.filters),
    criteria.sort
  );
}

function parseOrThrow<T>(parse: () => T) {
  try {
    return parse();
  } catch {
    throw new DomainValidationError("Invalid transaction search criteria.");
  }
}
