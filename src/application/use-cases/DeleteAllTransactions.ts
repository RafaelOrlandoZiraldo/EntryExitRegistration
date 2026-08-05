import type { TransactionRepository } from "@application/ports";

export interface DeleteAllTransactionsDependencies {
  repository: TransactionRepository;
}

export class DeleteAllTransactions {
  constructor(private readonly dependencies: DeleteAllTransactionsDependencies) {}

  async execute() {
    if (this.dependencies.repository.deleteAll) {
      await this.dependencies.repository.deleteAll();
      return;
    }

    await this.dependencies.repository.replaceAll([]);
  }
}
