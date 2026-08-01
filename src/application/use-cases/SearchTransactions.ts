import {
  searchTransactions,
  type SearchTransactionsCriteria
} from "@domain/transactions";
import type { TransactionRepository } from "@application/ports";

export interface SearchTransactionsDependencies {
  repository: TransactionRepository;
}

export class SearchTransactions {
  constructor(private readonly dependencies: SearchTransactionsDependencies) {}

  async execute(criteria: SearchTransactionsCriteria = {}) {
    const transactions = await this.dependencies.repository.getAll();

    return searchTransactions(transactions, criteria);
  }
}
