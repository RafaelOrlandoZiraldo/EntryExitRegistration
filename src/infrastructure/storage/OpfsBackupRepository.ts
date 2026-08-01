import type { BackupRepository } from "@application/ports";
import { storageDocumentSchema, type StorageDocument } from "@domain/storage";
import { DataValidationError } from "./errors";
import type { TextFileAdapter } from "./TextFileAdapter";

export class OpfsBackupRepository implements BackupRepository {
  constructor(private readonly fileAdapter: TextFileAdapter) {}

  async exists(fileName: string) {
    return (await this.fileAdapter.readText(fileName)) !== null;
  }

  async write(fileName: string, document: StorageDocument) {
    const result = storageDocumentSchema.safeParse(document);

    if (!result.success) {
      throw new DataValidationError({ cause: result.error });
    }

    await this.fileAdapter.writeText(
      fileName,
      `${JSON.stringify(result.data, null, 2)}\n`
    );
  }
}
