import { z } from "zod";
import { financialTransactionSchema } from "@domain/transactions/schemas";

export const currentStorageSchemaVersion = 1;

export const storageDocumentSchema = z.object({
  schemaVersion: z.literal(currentStorageSchemaVersion),
  lastUpdatedAt: z.string().datetime({ offset: true }),
  transactions: z.array(financialTransactionSchema)
});

export type StorageDocument = z.infer<typeof storageDocumentSchema>;
