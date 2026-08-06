import { TransactionNotFoundError } from "@domain/errors";
import type { TransactionRepository } from "@application/ports";

export interface DeleteTransactionDependencies {
  repository: TransactionRepository;
}

export class DeleteTransaction {
  constructor(private readonly dependencies: DeleteTransactionDependencies) {}

  async execute(id: string) {
    if (hasDeleteTransaction(this.dependencies.repository)) {
      await this.dependencies.repository.delete(id);

      return;
    }

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

function hasDeleteTransaction(
  repository: TransactionRepository
): repository is TransactionRepository & {
  delete(id: string): Promise<void>;
} {
  return "delete" in repository && typeof repository.delete === "function";
}
