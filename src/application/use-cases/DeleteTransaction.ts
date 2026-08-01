import { TransactionNotFoundError } from "@domain/errors";
import type { TransactionRepository } from "@application/ports";

export interface DeleteTransactionDependencies {
  repository: TransactionRepository;
}

export class DeleteTransaction {
  constructor(private readonly dependencies: DeleteTransactionDependencies) {}

  async execute(id: string) {
    await this.dependencies.repository.updateAll((existingTransactions) => {
      const exists = existingTransactions.some(
        (transaction) => transaction.id === id
      );

      if (!exists) {
        throw new TransactionNotFoundError(id);
      }

      return existingTransactions.filter((transaction) => transaction.id !== id);
    });
  }
}
