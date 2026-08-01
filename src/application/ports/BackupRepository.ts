import type { StorageDocument } from "@domain/storage";

export interface BackupRepository {
  exists(fileName: string): Promise<boolean>;
  write(fileName: string, document: StorageDocument): Promise<void>;
}
