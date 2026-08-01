import { describe, expect, it } from "vitest";
import type { StorageDocument } from "@domain/storage";
import { InMemoryTextFileAdapter } from "./InMemoryTextFileAdapter";
import { OpfsBackupRepository } from "./OpfsBackupRepository";

const document: StorageDocument = {
  schemaVersion: 1,
  lastUpdatedAt: "2026-08-01T12:00:00.000Z",
  transactions: []
};

describe("OpfsBackupRepository", () => {
  it("exists_WhenFileIsPresent_ShouldReturnTrue", async () => {
    const adapter = new InMemoryTextFileAdapter(
      new Map([["domestic-finance-backup-2026-08-01.json", "{}"]])
    );
    const repository = new OpfsBackupRepository(adapter);

    await expect(
      repository.exists("domestic-finance-backup-2026-08-01.json")
    ).resolves.toBe(true);
  });

  it("write_WhenDocumentIsValid_ShouldPersistVersionedJson", async () => {
    const adapter = new InMemoryTextFileAdapter();
    const repository = new OpfsBackupRepository(adapter);

    await repository.write("domestic-finance-backup-2026-08-01.json", document);

    expect(
      JSON.parse(
        adapter.peek("domestic-finance-backup-2026-08-01.json") ?? ""
      ) as unknown
    ).toEqual(document);
  });
});
