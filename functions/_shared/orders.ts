import type { AuthSession } from "./types";
import { assertActiveClientBelongsToUser } from "./clients";

export type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled";

export interface OrderItem {
  id: string;
  orderId: string;
  articleId: string;
  articleName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  status: OrderStatus;
  paymentMethod: string;
  totalAmount: number;
  notes?: string;
  transactionId: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  items: OrderItem[];
}

export interface OrderInput {
  customerId: string;
  status: OrderStatus;
  paymentMethod: string;
  notes?: string;
  items: Array<{
    articleId: string;
    quantity: number;
  }>;
}

interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string;
  status: OrderStatus;
  payment_method: string;
  total_amount: number;
  notes: string | null;
  transaction_id: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

interface OrderItemRow {
  id: string;
  order_id: string;
  article_id: string;
  article_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface ArticleForOrderRow {
  id: string;
  name: string;
  price: number | null;
  active: number;
  quantity: number | null;
}

export async function listOrders(db: D1Database, session: AuthSession) {
  const statement =
    session.role === "admin"
      ? db.prepare(
          `SELECT id, order_number, customer_id, customer_name, status, payment_method,
                  total_amount, notes, transaction_id, created_at, updated_at,
                  user_id
           FROM orders
           ORDER BY created_at DESC`
        )
      : db
          .prepare(
            `SELECT id, order_number, customer_id, customer_name, status, payment_method,
                    total_amount, notes, transaction_id, created_at, updated_at,
                    user_id
             FROM orders
             WHERE user_id = ?
             ORDER BY created_at DESC`
          )
          .bind(session.userId);
  const result = await statement.all<OrderRow>();
  const orders = (result.results ?? []).map(mapOrderRow);

  if (orders.length === 0) {
    return [];
  }

  const orderIds = orders.map((order) => order.id);
  const placeholders = orderIds.map(() => "?").join(", ");
  const itemsResult = await db
    .prepare(
      `SELECT id, order_id, article_id, article_name, quantity, unit_price,
              line_total
       FROM order_items
       WHERE order_id IN (${placeholders})
       ORDER BY article_name COLLATE NOCASE`
    )
    .bind(...orderIds)
    .all<OrderItemRow>();
  const itemsByOrder = (itemsResult.results ?? []).reduce<
    Record<string, OrderItem[]>
  >((groups, row) => {
    const item = mapOrderItemRow(row);
    groups[item.orderId] = [...(groups[item.orderId] ?? []), item];
    return groups;
  }, {});

  return orders.map((order) => ({
    ...order,
    items: itemsByOrder[order.id] ?? []
  }));
}

export async function createOrder(
  db: D1Database,
  input: OrderInput,
  session: AuthSession
) {
  assertUserCanMutateOrders(session);

  const requestedItems = mergeOrderItems(input.items);
  const client = await getClientForOrder(db, input.customerId, session);
  const articles = await getArticlesForOrder(db, requestedItems, session);

  if (articles.length !== requestedItems.length) {
    throw new Error("Invalid article.");
  }

  const articlesById = new Map(articles.map((article) => [article.id, article]));
  const now = new Date().toISOString();
  const orderId = crypto.randomUUID();
  const transactionId = crypto.randomUUID();
  const orderNumber = createOrderNumber(now);
  const orderItems = requestedItems.map((item) => {
    const article = articlesById.get(item.articleId);

    if (!article || article.active !== 1) {
      throw new Error("Invalid article.");
    }

    if (article.price === null || article.price <= 0) {
      throw new Error("Missing price.");
    }

    if ((article.quantity ?? 0) < item.quantity) {
      throw new Error("Insufficient stock.");
    }

    const lineTotal = roundMoney(item.quantity * article.price);

    return {
      id: crypto.randomUUID(),
      orderId,
      articleId: item.articleId,
      articleName: article.name,
      quantity: item.quantity,
      unitPrice: article.price,
      lineTotal
    };
  });
  const totalAmount = roundMoney(
    orderItems.reduce((total, item) => total + item.lineTotal, 0)
  );

  if (totalAmount <= 0) {
    throw new Error("Invalid order.");
  }

  await db.batch([
    db
      .prepare(
        `INSERT INTO transactions
         (id, type, date, amount, category, description, payment_method, notes,
          created_at, updated_at, user_id)
         VALUES (?, 'income', ?, ?, 'sale', ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        transactionId,
        now.slice(0, 10),
        totalAmount,
        `Pedido ${orderNumber} - ${client.name}`,
        input.paymentMethod,
        input.notes ?? null,
        now,
        now,
        session.userId
      ),
    db
      .prepare(
        `INSERT INTO orders
         (id, order_number, customer_id, customer_name, status, payment_method, total_amount,
          notes, transaction_id, created_at, updated_at, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        orderId,
        orderNumber,
        client.id,
        client.name,
        input.status,
        input.paymentMethod,
        totalAmount,
        input.notes ?? null,
        transactionId,
        now,
        now,
        session.userId
      ),
    ...orderItems.map((item) =>
      db
        .prepare(
          `INSERT INTO order_items
           (id, order_id, article_id, article_name, quantity, unit_price,
            line_total)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          item.id,
          item.orderId,
          item.articleId,
          item.articleName,
          item.quantity,
          item.unitPrice,
          item.lineTotal
        )
    ),
    ...orderItems.map((item) =>
      db
        .prepare(
          `INSERT INTO inventory_movements
           (id, article_id, type, quantity, reason, notes, created_at, user_id)
           VALUES (?, ?, 'out', ?, ?, ?, ?, ?)`
        )
        .bind(
          crypto.randomUUID(),
          item.articleId,
          item.quantity,
          `Pedido ${orderNumber}`,
          client.name,
          now,
          session.userId
        )
    )
  ]);

  const order = await getOrder(db, orderId, session);

  if (!order) {
    throw new Error("Order was not created.");
  }

  return order;
}

export async function updateOrderStatus(
  db: D1Database,
  id: string,
  status: OrderStatus,
  session: AuthSession
) {
  assertUserCanMutateOrders(session);

  const now = new Date().toISOString();

  await db
    .prepare(
      `UPDATE orders
       SET status = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    )
    .bind(status, now, id, session.userId)
    .run();

  const order = await getOrder(db, id, session);

  if (!order) {
    throw new Error("Not found.");
  }

  return order;
}

export function readOrderInput(value: unknown): OrderInput | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as Partial<OrderInput>;
  const customerId = readRequiredText(candidate.customerId);
  const paymentMethod = readRequiredText(candidate.paymentMethod);

  if (
    !customerId ||
    !paymentMethod ||
    !isPaymentMethod(paymentMethod) ||
    !isOrderStatus(candidate.status) ||
    !Array.isArray(candidate.items) ||
    candidate.items.length === 0
  ) {
    return null;
  }

  const items = candidate.items.map(readOrderItemInput);

  if (items.some((item) => item === null)) {
    return null;
  }

  return {
    customerId,
    status: candidate.status,
    paymentMethod,
    items: items as OrderInput["items"],
    ...readOptionalTextProperty("notes", candidate.notes)
  };
}

export function readOrderStatusInput(value: unknown): OrderStatus | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as { status?: unknown };

  return isOrderStatus(candidate.status) ? candidate.status : null;
}

async function getOrder(db: D1Database, id: string, session: AuthSession) {
  const row = await db
    .prepare(
      `SELECT id, order_number, customer_id, customer_name, status, payment_method,
              total_amount, notes, transaction_id, created_at, updated_at,
              user_id
       FROM orders
       WHERE id = ? AND user_id = ?`
    )
    .bind(id, session.userId)
    .first<OrderRow>();

  if (!row) {
    return null;
  }

  const itemResult = await db
    .prepare(
      `SELECT id, order_id, article_id, article_name, quantity, unit_price,
              line_total
       FROM order_items
       WHERE order_id = ?
       ORDER BY article_name COLLATE NOCASE`
    )
    .bind(id)
    .all<OrderItemRow>();

  return {
    ...mapOrderRow(row),
    items: (itemResult.results ?? []).map(mapOrderItemRow)
  };
}

async function getArticlesForOrder(
  db: D1Database,
  items: OrderInput["items"],
  session: AuthSession
) {
  const articleIds = items.map((item) => item.articleId);
  const placeholders = articleIds.map(() => "?").join(", ");

  const result = await db
    .prepare(
      `SELECT a.id, a.name, a.price, a.active,
              COALESCE(SUM(
                CASE m.type
                  WHEN 'in' THEN m.quantity
                  WHEN 'out' THEN -m.quantity
                  ELSE m.quantity
                END
              ), 0) AS quantity
       FROM catalog_articles a
       LEFT JOIN inventory_movements m ON m.article_id = a.id
       WHERE a.user_id = ? AND a.id IN (${placeholders})
       GROUP BY a.id, a.name, a.price, a.active`
    )
    .bind(session.userId, ...articleIds)
    .all<ArticleForOrderRow>();

  return result.results ?? [];
}

async function getClientForOrder(
  db: D1Database,
  id: string,
  session: AuthSession
) {
  await assertActiveClientBelongsToUser(db, id, session);

  const client = await db
    .prepare("SELECT id, name FROM clients WHERE id = ? AND user_id = ?")
    .bind(id, session.userId)
    .first<{ id: string; name: string }>();

  if (!client) {
    throw new Error("Invalid client.");
  }

  return client;
}

function mergeOrderItems(items: OrderInput["items"]) {
  const quantitiesByArticle = items.reduce<Record<string, number>>(
    (quantities, item) => {
      quantities[item.articleId] = (quantities[item.articleId] ?? 0) + item.quantity;
      return quantities;
    },
    {}
  );

  return Object.entries(quantitiesByArticle).map(([articleId, quantity]) => ({
    articleId,
    quantity
  }));
}

function readOrderItemInput(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const candidate = value as { articleId?: unknown; quantity?: unknown };
  const articleId = readRequiredText(candidate.articleId);

  if (
    !articleId ||
    typeof candidate.quantity !== "number" ||
    !Number.isFinite(candidate.quantity) ||
    candidate.quantity <= 0
  ) {
    return null;
  }

  return {
    articleId,
    quantity: candidate.quantity
  };
}

function mapOrderRow(row: OrderRow): Omit<Order, "items"> {
  return {
    id: row.id,
    orderNumber: row.order_number,
    ...(row.customer_id ? { customerId: row.customer_id } : {}),
    customerName: row.customer_name,
    status: row.status,
    paymentMethod: row.payment_method,
    totalAmount: row.total_amount,
    ...(row.notes ? { notes: row.notes } : {}),
    transactionId: row.transaction_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.user_id ? { userId: row.user_id } : {})
  };
}

function mapOrderItemRow(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    articleId: row.article_id,
    articleName: row.article_name,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: row.line_total
  };
}

function createOrderNumber(value: string) {
  const datePart = value.slice(0, 10).replaceAll("-", "");
  const randomPart = crypto.randomUUID().slice(0, 8).toUpperCase();

  return `PED-${datePart}-${randomPart}`;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === "pending" ||
    value === "confirmed" ||
    value === "delivered" ||
    value === "cancelled"
  );
}

function isPaymentMethod(value: string) {
  return (
    value === "cash" ||
    value === "debit_card" ||
    value === "credit_card" ||
    value === "bank_transfer" ||
    value === "digital_wallet" ||
    value === "other"
  );
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

function assertUserCanMutateOrders(session: AuthSession) {
  if (session.role !== "user") {
    throw new Error("Forbidden.");
  }
}
