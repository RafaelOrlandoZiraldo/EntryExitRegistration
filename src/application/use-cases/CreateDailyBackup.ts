import type { BackupRepository, TransactionRepository } from "@application/ports";

export interface CreateDailyBackupInput {
  backupDate: string;
}

export interface CreateDailyBackupDependencies {
  backupRepository: BackupRepository;
  transactionRepository: TransactionRepository;
}

export interface CreateDailyBackupResult {
  fileName: string;
  created: boolean;
}

export class CreateDailyBackup {
  constructor(private readonly dependencies: CreateDailyBackupDependencies) {}

  async execute(input: CreateDailyBackupInput): Promise<CreateDailyBackupResult> {
    const fileName = createDailyBackupFileName(input.backupDate);
    const alreadyExists = await this.dependencies.backupRepository.exists(
      fileName
    );

    if (alreadyExists) {
      return { fileName, created: false };
    }

    const document = await this.dependencies.transactionRepository.getDocument();

    await this.dependencies.backupRepository.write(fileName, document);

    return { fileName, created: true };
  }
}

export function createDailyBackupFileName(date: string) {
  return `domestic-finance-backup-${date}.json`;
}
