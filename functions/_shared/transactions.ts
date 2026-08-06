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

interface ExpenseCategoryAggregateRow {
  category: string;
  amount: number;
}

const expenseCategoryLabels = new Map([
  ["rent", "Alquiler"],
  ["utilities", "Servicios"],
  ["groceries", "Supermercado"],
  ["transport", "Transporte"],
  ["health", "Salud"],
  ["education", "Educacion"],
  ["entertainment", "Entretenimiento"],
  ["clothing", "Indumentaria"],
  ["taxes", "Impuestos"],
  ["debts", "Deudas"],
  ["maintenance", "Mantenimiento"],
  ["pets", "Mascotas"],
  ["other_expense", "Otros egresos"]
]);

export interface TransactionsPageQuery {
  pageIndex: number;
  pageSize: number;
  filters: {
    dateFrom?: string;
    dateTo?: string;
    type?: "income" | "expense";
    category?: string;
    paymentMethod?: string;
    text?: string;
    amountMin?: number;
    amountMax?: number;
  };
  sort: {
    field: "date" | "amount" | "category";
    direction: "asc" | "desc";
  };
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

export async function getTransactionsPage(
  db: D1Database,
  query: TransactionsPageQuery
) {
  const { whereSql, bindings } = createTransactionFilterClause(query.filters);
  const orderSql = createTransactionOrderClause(query.sort);
  const limit = query.pageSize;
  const offset = query.pageIndex * query.pageSize;
  const countResult = await db
    .prepare(`SELECT COUNT(*) as total FROM transactions${whereSql}`)
    .bind(...bindings)
    .first<{ total: number }>();
  const result = await db
    .prepare(
      `SELECT id, type, date, amount, category, description, payment_method, notes, created_at, updated_at
       FROM transactions${whereSql}
       ${orderSql}
       LIMIT ? OFFSET ?`
    )
    .bind(...bindings, limit, offset)
    .all<TransactionRow>();
  const dashboard = await getTransactionsDashboard(db, whereSql, bindings);

  return {
    transactions: (result.results ?? []).map(mapRowToTransaction),
    total: countResult?.total ?? 0,
    dashboard
  };
}

export async function getTransactionById(db: D1Database, id: string) {
  const row = await db
    .prepare(
      `SELECT id, type, date, amount, category, description, payment_method, notes, created_at, updated_at
       FROM transactions
       WHERE id = ?`
    )
    .bind(id)
    .first<TransactionRow>();

  return row ? mapRowToTransaction(row) : null;
}

async function getTransactionsDashboard(
  db: D1Database,
  whereSql: string,
  bindings: (number | string)[]
) {
  const summary = await db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
         COUNT(*) as transactionCount
       FROM transactions${whereSql}`
    )
    .bind(...bindings)
    .first<{
      income: number;
      expenses: number;
      transactionCount: number;
    }>();
  const expenseResult = await db
    .prepare(
      `SELECT category, SUM(amount) as amount
       FROM transactions${whereSql}
       ${whereSql.length > 0 ? "AND" : "WHERE"} type = 'expense'
       GROUP BY category
       ORDER BY amount DESC, category ASC`
    )
    .bind(...bindings)
    .all<ExpenseCategoryAggregateRow>();
  const income = summary?.income ?? 0;
  const expenses = summary?.expenses ?? 0;

  return {
    summary: {
      income,
      expenses,
      balance: income - expenses,
      transactionCount: summary?.transactionCount ?? 0
    },
    expenseDistribution: (expenseResult.results ?? []).map((row) => ({
      category: row.category,
      label: expenseCategoryLabels.get(row.category) ?? row.category,
      amount: row.amount,
      proportion: expenses === 0 ? 0 : row.amount / expenses
    }))
  };
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

export function readTransactionsPageQuery(request: Request) {
  const params = new URL(request.url).searchParams;
  const pageIndex = readInteger(params.get("pageIndex"), 0, 0, 100000);
  const pageSize = readInteger(params.get("pageSize"), 10, 1, 100);
  const sortField = params.get("sortField");
  const sortDirection = params.get("sortDirection");
  const filters: TransactionsPageQuery["filters"] = {};

  if (isIsoDate(params.get("dateFrom"))) {
    filters.dateFrom = params.get("dateFrom") ?? undefined;
  }

  if (isIsoDate(params.get("dateTo"))) {
    filters.dateTo = params.get("dateTo") ?? undefined;
  }

  if (params.get("type") === "income" || params.get("type") === "expense") {
    filters.type = params.get("type") as "income" | "expense";
  }

  if (hasText(params.get("category"))) {
    filters.category = params.get("category") ?? undefined;
  }

  if (hasText(params.get("paymentMethod"))) {
    filters.paymentMethod = params.get("paymentMethod") ?? undefined;
  }

  if (hasText(params.get("text"))) {
    filters.text = params.get("text")?.trim();
  }

  const amountMin = readNumber(params.get("amountMin"));
  const amountMax = readNumber(params.get("amountMax"));

  if (amountMin !== null) {
    filters.amountMin = amountMin;
  }

  if (amountMax !== null) {
    filters.amountMax = amountMax;
  }

  return {
    pageIndex,
    pageSize,
    filters,
    sort: {
      field:
        sortField === "amount" || sortField === "category"
          ? sortField
          : "date",
      direction: sortDirection === "asc" ? "asc" : "desc"
    }
  } satisfies TransactionsPageQuery;
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

function createTransactionFilterClause(
  filters: TransactionsPageQuery["filters"]
) {
  const clauses: string[] = [];
  const bindings: (number | string)[] = [];

  if (filters.dateFrom !== undefined) {
    clauses.push("date >= ?");
    bindings.push(filters.dateFrom);
  }

  if (filters.dateTo !== undefined) {
    clauses.push("date <= ?");
    bindings.push(filters.dateTo);
  }

  if (filters.type !== undefined) {
    clauses.push("type = ?");
    bindings.push(filters.type);
  }

  if (filters.category !== undefined) {
    clauses.push("category = ?");
    bindings.push(filters.category);
  }

  if (filters.paymentMethod !== undefined) {
    clauses.push("payment_method = ?");
    bindings.push(filters.paymentMethod);
  }

  if (filters.amountMin !== undefined) {
    clauses.push("amount >= ?");
    bindings.push(filters.amountMin);
  }

  if (filters.amountMax !== undefined) {
    clauses.push("amount <= ?");
    bindings.push(filters.amountMax);
  }

  if (filters.text !== undefined) {
    clauses.push(
      "(LOWER(description) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(notes, '')) LIKE ? ESCAPE '\\')"
    );
    bindings.push(`%${escapeLike(filters.text.toLocaleLowerCase())}%`);
    bindings.push(`%${escapeLike(filters.text.toLocaleLowerCase())}%`);
  }

  return {
    whereSql: clauses.length > 0 ? ` WHERE ${clauses.join(" AND ")}` : "",
    bindings
  };
}

function createTransactionOrderClause(sort: TransactionsPageQuery["sort"]) {
  const fieldByColumn = {
    amount: "amount",
    category: "category",
    date: "date"
  } satisfies Record<TransactionsPageQuery["sort"]["field"], string>;
  const direction = sort.direction === "asc" ? "ASC" : "DESC";

  return `ORDER BY ${fieldByColumn[sort.field]} ${direction}, id ASC`;
}

function readInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number
) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function readNumber(value: string | null) {
  if (value === null) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isIsoDate(value: string | null) {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function hasText(value: string | null) {
  return value !== null && value.trim().length > 0;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
