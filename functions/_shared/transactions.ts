import type { FinancialTransaction, StorageDocument } from "./types";

interface TransactionRow {
  id: string;
  type: "income" | "expense";
  date: string;
  amount: number;
  category: string;
  description: string;
  payment_method: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function getTransactions(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT id, type, date, amount, category, description, payment_method, notes, created_at, updated_at
       FROM transactions
       ORDER BY date DESC, created_at DESC`
    )
    .all<TransactionRow>();

  return (result.results ?? []).map(mapRowToTransaction);
}

export async function getDocument(db: D1Database): Promise<StorageDocument> {
  return {
    schemaVersion: 1,
    lastUpdatedAt: new Date().toISOString(),
    transactions: await getTransactions(db)
  };
}

export async function createTransaction(
  db: D1Database,
  transaction: FinancialTransaction
) {
  await db
    .prepare(
      `INSERT INTO transactions
       (id, type, date, amount, category, description, payment_method, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      transaction.id,
      transaction.type,
      transaction.date,
      transaction.amount,
      transaction.category,
      transaction.description,
      transaction.paymentMethod,
      transaction.notes ?? null,
      transaction.createdAt,
      transaction.updatedAt
    )
    .run();
}

export async function updateTransaction(
  db: D1Database,
  transaction: FinancialTransaction
) {
  await db
    .prepare(
      `UPDATE transactions
       SET type = ?, date = ?, amount = ?, category = ?, description = ?,
           payment_method = ?, notes = ?, created_at = ?, updated_at = ?
       WHERE id = ?`
    )
    .bind(
      transaction.type,
      transaction.date,
      transaction.amount,
      transaction.category,
      transaction.description,
      transaction.paymentMethod,
      transaction.notes ?? null,
      transaction.createdAt,
      transaction.updatedAt,
      transaction.id
    )
    .run();
}

export async function deleteTransaction(db: D1Database, id: string) {
  await db.prepare("DELETE FROM transactions WHERE id = ?").bind(id).run();
}

export async function deleteAllTransactions(db: D1Database) {
  await db.prepare("DELETE FROM transactions").run();
}

export async function replaceDocument(db: D1Database, document: StorageDocument) {
  const statements = [
    db.prepare("DELETE FROM transactions"),
    ...document.transactions.map((transaction) =>
      db
        .prepare(
          `INSERT INTO transactions
           (id, type, date, amount, category, description, payment_method, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          transaction.id,
          transaction.type,
          transaction.date,
          transaction.amount,
          transaction.category,
          transaction.description,
          transaction.paymentMethod,
          transaction.notes ?? null,
          transaction.createdAt,
          transaction.updatedAt
        )
    )
  ];

  await db.batch(statements);
}

export async function createDailyBackup(db: D1Database, date: string) {
  const fileName = `domestic-finance-backup-${date}.json`;
  const existing = await db
    .prepare("SELECT file_name FROM daily_backups WHERE file_name = ?")
    .bind(fileName)
    .first<{ file_name: string }>();

  if (existing) {
    return { fileName, created: false };
  }

  const document = await getDocument(db);

  await db
    .prepare(
      "INSERT INTO daily_backups (file_name, created_at, document_json) VALUES (?, ?, ?)"
    )
    .bind(fileName, new Date().toISOString(), JSON.stringify(document))
    .run();

  return { fileName, created: true };
}

export function readTransaction(value: unknown): FinancialTransaction | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<FinancialTransaction>;

  if (
    typeof candidate.id !== "string" ||
    (candidate.type !== "income" && candidate.type !== "expense") ||
    typeof candidate.date !== "string" ||
    typeof candidate.amount !== "number" ||
    candidate.amount <= 0 ||
    typeof candidate.category !== "string" ||
    typeof candidate.description !== "string" ||
    candidate.description.trim().length === 0 ||
    typeof candidate.paymentMethod !== "string" ||
    typeof candidate.createdAt !== "string" ||
    typeof candidate.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    type: candidate.type,
    date: candidate.date,
    amount: candidate.amount,
    category: candidate.category,
    description: candidate.description.trim(),
    paymentMethod: candidate.paymentMethod,
    ...(typeof candidate.notes === "string" && candidate.notes.trim().length > 0
      ? { notes: candidate.notes.trim() }
      : {}),
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt
  };
}

export function readDocument(value: unknown): StorageDocument | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<StorageDocument>;

  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.transactions)) {
    return null;
  }

  const transactions = candidate.transactions.map(readTransaction);

  if (transactions.some((transaction) => transaction === null)) {
    return null;
  }

  return {
    schemaVersion: 1,
    lastUpdatedAt:
      typeof candidate.lastUpdatedAt === "string"
        ? candidate.lastUpdatedAt
        : new Date().toISOString(),
    transactions: transactions as FinancialTransaction[]
  };
}

function mapRowToTransaction(row: TransactionRow): FinancialTransaction {
  return {
    id: row.id,
    type: row.type,
    date: row.date,
    amount: row.amount,
    category: row.category,
    description: row.description,
    paymentMethod: row.payment_method,
    ...(row.notes ? { notes: row.notes } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
