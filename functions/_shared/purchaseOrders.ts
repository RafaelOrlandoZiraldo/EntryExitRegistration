import type { AuthSession } from "./types";

export type PurchaseOrderStatus = "draft" | "sent" | "received" | "cancelled";

export interface PurchaseOrderItem {
  id: string;
  articleId: string;
  articleName: string;
  categoryName: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierName: string;
  supplierContact?: string;
  expectedDate?: string;
  status: PurchaseOrderStatus;
  paymentTerms?: string;
  notes?: string;
  items: PurchaseOrderItem[];
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  receivedAt?: string;
  inventoryPostedAt?: string;
  userId?: string;
}

export interface PurchaseOrderItemInput {
  articleId: string;
  quantity: number;
  unitCost: number;
  notes?: string;
}

export interface PurchaseOrderInput {
  supplierName: string;
  supplierContact?: string;
  expectedDate?: string;
  status: PurchaseOrderStatus;
  paymentTerms?: string;
  notes?: string;
  items: PurchaseOrderItemInput[];
}

interface PurchaseOrderRow {
  id: string;
  order_number: string;
  supplier_name: string;
  supplier_contact: string | null;
  expected_date: string | null;
  status: PurchaseOrderStatus;
  payment_terms: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  received_at: string | null;
  inventory_posted_at: string | null;
  user_id: string | null;
}

interface PurchaseOrderItemRow {
  id: string;
  purchase_order_id: string;
  article_id: string;
  article_name: string;
  category_name: string;
  quantity: number;
  unit_cost: number;
  notes: string | null;
}

export async function listPurchaseOrders(
  db: D1Database,
  session: AuthSession
) {
  const statement =
    session.role === "admin"
      ? db.prepare(
          `SELECT id, order_number, supplier_name, supplier_contact,
                  expected_date, status, payment_terms, notes, created_at,
                  updated_at, received_at, inventory_posted_at, user_id
           FROM purchase_orders
           ORDER BY created_at DESC`
        )
      : db
          .prepare(
            `SELECT id, order_number, supplier_name, supplier_contact,
                    expected_date, status, payment_terms, notes, created_at,
                    updated_at, received_at, inventory_posted_at, user_id
             FROM purchase_orders
             WHERE user_id = ?
             ORDER BY created_at DESC`
          )
          .bind(session.userId);
  const result = await statement.all<PurchaseOrderRow>();
  const rows = result.results ?? [];
  const itemsByOrderId = await listItemsByOrderId(
    db,
    rows.map((row) => row.id)
  );

  return {
    orders: rows.map((row) => mapOrderRow(row, itemsByOrderId[row.id] ?? []))
  };
}

export async function createPurchaseOrder(
  db: D1Database,
  input: PurchaseOrderInput,
  session: AuthSession
) {
  assertUserCanMutatePurchaseOrders(session);
  await assertArticlesBelongToUser(db, input.items, session);

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const orderNumber = await createOrderNumber(db, session);
  const shouldPostInventory = input.status === "received";

  await db
    .prepare(
      `INSERT INTO purchase_orders
       (id, order_number, supplier_name, supplier_contact, expected_date,
        status, payment_terms, notes, created_at, updated_at, received_at,
        inventory_posted_at, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      orderNumber,
      input.supplierName,
      input.supplierContact ?? null,
      input.expectedDate ?? null,
      input.status,
      input.paymentTerms ?? null,
      input.notes ?? null,
      now,
      now,
      shouldPostInventory ? now : null,
      shouldPostInventory ? now : null,
      session.userId
    )
    .run();

  await insertItems(db, id, input.items);

  if (shouldPostInventory) {
    await postPurchaseOrderEffects(
      db,
      id,
      input.items,
      session,
      orderNumber,
      input.supplierName,
      input.paymentTerms,
      now
    );
  }

  const order = await getPurchaseOrder(db, id, session);

  if (!order) {
    throw new Error("Purchase order was not created.");
  }

  return order;
}

export async function updatePurchaseOrderStatus(
  db: D1Database,
  id: string,
  status: PurchaseOrderStatus,
  session: AuthSession
) {
  assertUserCanMutatePurchaseOrders(session);

  const current = await getPurchaseOrder(db, id, session);

  if (!current) {
    throw new Error("Not found.");
  }

  if (current.status === "cancelled" || current.status === "received") {
    throw new Error("Status is closed.");
  }

  const now = new Date().toISOString();
  const shouldPostInventory =
    status === "received" && !current.inventoryPostedAt;

  await db
    .prepare(
      `UPDATE purchase_orders
       SET status = ?, updated_at = ?, received_at = ?, inventory_posted_at = ?
       WHERE id = ? AND user_id = ?`
    )
    .bind(
      status,
      now,
      status === "received" ? now : current.receivedAt ?? null,
      shouldPostInventory ? now : current.inventoryPostedAt ?? null,
      id,
      session.userId
    )
    .run();

  if (shouldPostInventory) {
    await postPurchaseOrderEffects(
      db,
      id,
      current.items,
      session,
      current.orderNumber,
      current.supplierName,
      current.paymentTerms,
      now
    );
  }

  const order = await getPurchaseOrder(db, id, session);

  if (!order) {
    throw new Error("Not found.");
  }

  return order;
}

export function readPurchaseOrderInput(
  value: unknown
): PurchaseOrderInput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<PurchaseOrderInput>;
  const supplierName = readRequiredText(candidate.supplierName);
  const items = Array.isArray(candidate.items)
    ? candidate.items.map(readPurchaseOrderItemInput).filter(isPresent)
    : [];

  if (
    !supplierName ||
    !isPurchaseOrderStatus(candidate.status) ||
    candidate.status === "cancelled" ||
    items.length === 0 ||
    items.length !== candidate.items?.length
  ) {
    return null;
  }

  return {
    supplierName,
    status: candidate.status,
    ...readOptionalTextProperty("supplierContact", candidate.supplierContact),
    ...readOptionalTextProperty("expectedDate", candidate.expectedDate),
    ...readOptionalTextProperty("paymentTerms", candidate.paymentTerms),
    ...readOptionalTextProperty("notes", candidate.notes),
    items
  };
}

export function readPurchaseOrderStatus(value: unknown) {
  return isPurchaseOrderStatus(value) ? value : null;
}

async function getPurchaseOrder(
  db: D1Database,
  id: string,
  session: AuthSession
) {
  const row = await db
    .prepare(
      `SELECT id, order_number, supplier_name, supplier_contact,
              expected_date, status, payment_terms, notes, created_at,
              updated_at, received_at, inventory_posted_at, user_id
       FROM purchase_orders
       WHERE id = ? AND user_id = ?`
    )
    .bind(id, session.userId)
    .first<PurchaseOrderRow>();

  if (!row) {
    return null;
  }

  const itemsByOrderId = await listItemsByOrderId(db, [id]);

  return mapOrderRow(row, itemsByOrderId[id] ?? []);
}

async function listItemsByOrderId(db: D1Database, orderIds: string[]) {
  const itemsByOrderId: Record<string, PurchaseOrderItem[]> = {};

  if (orderIds.length === 0) {
    return itemsByOrderId;
  }

  const placeholders = orderIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT i.id, i.purchase_order_id, i.article_id, a.name AS article_name,
              c.name AS category_name, i.quantity, i.unit_cost, i.notes
       FROM purchase_order_items i
       INNER JOIN catalog_articles a ON a.id = i.article_id
       INNER JOIN catalog_categories c ON c.id = a.category_id
       WHERE i.purchase_order_id IN (${placeholders})
       ORDER BY a.name COLLATE NOCASE`
    )
    .bind(...orderIds)
    .all<PurchaseOrderItemRow>();

  for (const row of result.results ?? []) {
    itemsByOrderId[row.purchase_order_id] ??= [];
    itemsByOrderId[row.purchase_order_id].push(mapItemRow(row));
  }

  return itemsByOrderId;
}

async function insertItems(
  db: D1Database,
  orderId: string,
  items: PurchaseOrderItemInput[]
) {
  for (const item of items) {
    await db
      .prepare(
        `INSERT INTO purchase_order_items
         (id, purchase_order_id, article_id, quantity, unit_cost, notes)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        orderId,
        item.articleId,
        item.quantity,
        item.unitCost,
        item.notes ?? null
      )
      .run();
  }
}

async function postPurchaseOrderEffects(
  db: D1Database,
  orderId: string,
  items: PurchaseOrderItemInput[],
  session: AuthSession,
  orderNumber: string,
  supplierName: string,
  paymentTerms: string | undefined,
  createdAt: string
) {
  const totalAmount = items.reduce(
    (total, item) => total + item.quantity * item.unitCost,
    0
  );

  await db
    .prepare(
      `INSERT INTO transactions
       (id, type, date, amount, category, description, payment_method, notes,
        created_at, updated_at, user_id)
       VALUES (?, 'expense', ?, ?, 'other_expense', ?, 'bank_transfer', ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      createdAt.slice(0, 10),
      Math.round(totalAmount * 100) / 100,
      `Orden de compra ${orderNumber} - ${supplierName}`,
      paymentTerms
        ? `Condiciones: ${paymentTerms}. Orden de compra ${orderNumber} (${orderId})`
        : `Orden de compra ${orderNumber} (${orderId})`,
      createdAt,
      createdAt,
      session.userId
    )
    .run();

  for (const item of items) {
    await db
      .prepare(
        `INSERT INTO inventory_movements
         (id, article_id, type, quantity, reason, notes, created_at, user_id)
         VALUES (?, ?, 'in', ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        item.articleId,
        item.quantity,
        `Recepcion ${orderNumber}`,
        `Orden de compra ${orderNumber} (${orderId})`,
        createdAt,
        session.userId
      )
      .run();
  }
}

async function createOrderNumber(db: D1Database, session: AuthSession) {
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM purchase_orders WHERE user_id = ?")
    .bind(session.userId)
    .first<{ count: number }>();
  const next = (row?.count ?? 0) + 1;

  return `OC-${String(next).padStart(5, "0")}`;
}

async function assertArticlesBelongToUser(
  db: D1Database,
  items: PurchaseOrderItemInput[],
  session: AuthSession
) {
  const articleIds = [...new Set(items.map((item) => item.articleId))];

  if (articleIds.length === 0) {
    throw new Error("Invalid article.");
  }

  const placeholders = articleIds.map(() => "?").join(", ");
  const result = await db
    .prepare(
      `SELECT id FROM catalog_articles
       WHERE user_id = ? AND id IN (${placeholders})`
    )
    .bind(session.userId, ...articleIds)
    .all<{ id: string }>();
  const found = new Set((result.results ?? []).map((row) => row.id));

  if (articleIds.some((id) => !found.has(id))) {
    throw new Error("Invalid article.");
  }
}

function readPurchaseOrderItemInput(
  value: unknown
): PurchaseOrderItemInput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<PurchaseOrderItemInput>;
  const articleId = readRequiredText(candidate.articleId);

  if (
    !articleId ||
    typeof candidate.quantity !== "number" ||
    typeof candidate.unitCost !== "number" ||
    !Number.isFinite(candidate.quantity) ||
    !Number.isFinite(candidate.unitCost) ||
    candidate.quantity <= 0 ||
    candidate.unitCost < 0
  ) {
    return null;
  }

  return {
    articleId,
    quantity: candidate.quantity,
    unitCost: candidate.unitCost,
    ...readOptionalTextProperty("notes", candidate.notes)
  };
}

function mapOrderRow(
  row: PurchaseOrderRow,
  items: PurchaseOrderItem[]
): PurchaseOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    supplierName: row.supplier_name,
    ...(row.supplier_contact ? { supplierContact: row.supplier_contact } : {}),
    ...(row.expected_date ? { expectedDate: row.expected_date } : {}),
    status: row.status,
    ...(row.payment_terms ? { paymentTerms: row.payment_terms } : {}),
    ...(row.notes ? { notes: row.notes } : {}),
    items,
    totalAmount: items.reduce((total, item) => total + item.lineTotal, 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.received_at ? { receivedAt: row.received_at } : {}),
    ...(row.inventory_posted_at
      ? { inventoryPostedAt: row.inventory_posted_at }
      : {}),
    ...(row.user_id ? { userId: row.user_id } : {})
  };
}

function mapItemRow(row: PurchaseOrderItemRow): PurchaseOrderItem {
  return {
    id: row.id,
    articleId: row.article_id,
    articleName: row.article_name,
    categoryName: row.category_name,
    quantity: row.quantity,
    unitCost: row.unit_cost,
    lineTotal: row.quantity * row.unit_cost,
    ...(row.notes ? { notes: row.notes } : {})
  };
}

function isPurchaseOrderStatus(value: unknown): value is PurchaseOrderStatus {
  return (
    value === "draft" ||
    value === "sent" ||
    value === "received" ||
    value === "cancelled"
  );
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
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

function assertUserCanMutatePurchaseOrders(session: AuthSession) {
  if (session.role !== "user") {
    throw new Error("Forbidden.");
  }
}
