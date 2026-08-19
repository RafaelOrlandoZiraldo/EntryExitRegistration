import type { AuthSession } from "./types";

export type InventoryMovementType = "in" | "out" | "adjustment";

export interface InventoryItem {
  articleId: string;
  articleName: string;
  categoryName: string;
  sku?: string;
  unit?: string;
  active: boolean;
  quantity: number;
}

export interface InventoryMovement {
  id: string;
  articleId: string;
  articleName: string;
  categoryName: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string;
  notes?: string;
  createdAt: string;
  userId?: string;
}

export interface InventoryMovementInput {
  articleId: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string;
  notes?: string;
}

interface InventoryItemRow {
  article_id: string;
  article_name: string;
  category_name: string;
  sku: string | null;
  unit: string | null;
  active: number;
  quantity: number | null;
}

interface InventoryMovementRow {
  id: string;
  article_id: string;
  article_name: string;
  category_name: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string;
  notes: string | null;
  created_at: string;
  user_id: string | null;
}

export async function listInventory(db: D1Database, session: AuthSession) {
  return {
    items: await listInventoryItems(db, session),
    movements: await listInventoryMovements(db, session)
  };
}

export async function listInventoryItems(db: D1Database, session: AuthSession) {
  const statement =
    session.role === "admin"
      ? db.prepare(
          `SELECT a.id AS article_id, a.name AS article_name,
                  c.name AS category_name, a.sku, a.unit, a.active,
                  COALESCE(SUM(
                    CASE m.type
                      WHEN 'in' THEN m.quantity
                      WHEN 'out' THEN -m.quantity
                      ELSE m.quantity
                    END
                  ), 0) AS quantity
           FROM catalog_articles a
           INNER JOIN catalog_categories c ON c.id = a.category_id
           LEFT JOIN inventory_movements m ON m.article_id = a.id
           GROUP BY a.id, a.name, c.name, a.sku, a.unit, a.active
           ORDER BY a.name COLLATE NOCASE`
        )
      : db
          .prepare(
            `SELECT a.id AS article_id, a.name AS article_name,
                    c.name AS category_name, a.sku, a.unit, a.active,
                    COALESCE(SUM(
                      CASE m.type
                        WHEN 'in' THEN m.quantity
                        WHEN 'out' THEN -m.quantity
                        ELSE m.quantity
                      END
                    ), 0) AS quantity
             FROM catalog_articles a
             INNER JOIN catalog_categories c ON c.id = a.category_id
             LEFT JOIN inventory_movements m ON m.article_id = a.id
             WHERE a.user_id = ?
             GROUP BY a.id, a.name, c.name, a.sku, a.unit, a.active
             ORDER BY a.name COLLATE NOCASE`
          )
          .bind(session.userId);

  const result = await statement.all<InventoryItemRow>();

  return (result.results ?? []).map(mapInventoryItemRow);
}

export async function listInventoryMovements(
  db: D1Database,
  session: AuthSession
) {
  const statement =
    session.role === "admin"
      ? db.prepare(
          `SELECT m.id, m.article_id, a.name AS article_name,
                  c.name AS category_name, m.type, m.quantity, m.reason,
                  m.notes, m.created_at, m.user_id
           FROM inventory_movements m
           INNER JOIN catalog_articles a ON a.id = m.article_id
           INNER JOIN catalog_categories c ON c.id = a.category_id
           ORDER BY m.created_at DESC
           LIMIT 100`
        )
      : db
          .prepare(
            `SELECT m.id, m.article_id, a.name AS article_name,
                    c.name AS category_name, m.type, m.quantity, m.reason,
                    m.notes, m.created_at, m.user_id
             FROM inventory_movements m
             INNER JOIN catalog_articles a ON a.id = m.article_id
             INNER JOIN catalog_categories c ON c.id = a.category_id
             WHERE m.user_id = ?
             ORDER BY m.created_at DESC
             LIMIT 100`
          )
          .bind(session.userId);

  const result = await statement.all<InventoryMovementRow>();

  return (result.results ?? []).map(mapMovementRow);
}

export async function createInventoryMovement(
  db: D1Database,
  input: InventoryMovementInput,
  session: AuthSession
) {
  assertUserCanMutateInventory(session);
  await assertArticleBelongsToUser(db, input.articleId, session);

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db
    .prepare(
      `INSERT INTO inventory_movements
       (id, article_id, type, quantity, reason, notes, created_at, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      input.articleId,
      input.type,
      input.quantity,
      input.reason,
      input.notes ?? null,
      createdAt,
      session.userId
    )
    .run();

  const movement = await getMovement(db, id, session);

  if (!movement) {
    throw new Error("Movement was not created.");
  }

  return movement;
}

export function readInventoryMovementInput(
  value: unknown
): InventoryMovementInput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<InventoryMovementInput>;
  const articleId = readRequiredText(candidate.articleId);
  const reason = readRequiredText(candidate.reason);

  if (
    !articleId ||
    !reason ||
    !isMovementType(candidate.type) ||
    typeof candidate.quantity !== "number" ||
    !Number.isFinite(candidate.quantity) ||
    candidate.quantity === 0 ||
    (candidate.type !== "adjustment" && candidate.quantity <= 0)
  ) {
    return null;
  }

  return {
    articleId,
    type: candidate.type,
    quantity: candidate.quantity,
    reason,
    ...readOptionalTextProperty("notes", candidate.notes)
  };
}

async function getMovement(db: D1Database, id: string, session: AuthSession) {
  const row = await db
    .prepare(
      `SELECT m.id, m.article_id, a.name AS article_name,
              c.name AS category_name, m.type, m.quantity, m.reason, m.notes,
              m.created_at, m.user_id
       FROM inventory_movements m
       INNER JOIN catalog_articles a ON a.id = m.article_id
       INNER JOIN catalog_categories c ON c.id = a.category_id
       WHERE m.id = ? AND m.user_id = ?`
    )
    .bind(id, session.userId)
    .first<InventoryMovementRow>();

  return row ? mapMovementRow(row) : null;
}

async function assertArticleBelongsToUser(
  db: D1Database,
  id: string,
  session: AuthSession
) {
  const article = await db
    .prepare("SELECT id FROM catalog_articles WHERE id = ? AND user_id = ?")
    .bind(id, session.userId)
    .first<{ id: string }>();

  if (!article) {
    throw new Error("Invalid article.");
  }
}

function mapInventoryItemRow(row: InventoryItemRow): InventoryItem {
  return {
    articleId: row.article_id,
    articleName: row.article_name,
    categoryName: row.category_name,
    ...(row.sku ? { sku: row.sku } : {}),
    ...(row.unit ? { unit: row.unit } : {}),
    active: row.active === 1,
    quantity: row.quantity ?? 0
  };
}

function mapMovementRow(row: InventoryMovementRow): InventoryMovement {
  return {
    id: row.id,
    articleId: row.article_id,
    articleName: row.article_name,
    categoryName: row.category_name,
    type: row.type,
    quantity: row.quantity,
    reason: row.reason,
    ...(row.notes ? { notes: row.notes } : {}),
    createdAt: row.created_at,
    ...(row.user_id ? { userId: row.user_id } : {})
  };
}

function isMovementType(value: unknown): value is InventoryMovementType {
  return value === "in" || value === "out" || value === "adjustment";
}

function readRequiredText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalTextProperty(key: string, value: unknown) {
  if (typeof value !== "string") {
    return {};
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? { [key]: trimmed } : {};
}

function assertUserCanMutateInventory(session: AuthSession) {
  if (session.role !== "user") {
    throw new Error("Forbidden.");
  }
}
