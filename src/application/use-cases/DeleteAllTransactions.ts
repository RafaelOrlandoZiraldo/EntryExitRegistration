import type { TransactionRepository } from "@application/ports";

export interface DeleteAllTransactionsDependencies {
  repository: TransactionRepository;
}

export class DeleteAllTransactions {
  constructor(private readonly dependencies: DeleteAllTransactionsDependencies) {}

  async execute() {
    await this.dependencies.repository.replaceAll([]);
  }
}
