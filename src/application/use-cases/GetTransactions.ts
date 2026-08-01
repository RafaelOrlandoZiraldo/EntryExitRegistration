import type { TransactionRepository } from "@application/ports";

export interface GetTransactionsDependencies {
  repository: TransactionRepository;
}

export class GetTransactions {
  constructor(private readonly dependencies: GetTransactionsDependencies) {}

  async execute() {
    return this.dependencies.repository.getAll();
  }
}
