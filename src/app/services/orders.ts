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
  customerName: string;
  status: OrderStatus;
  paymentMethod: string;
  notes?: string;
  items: Array<{
    articleId: string;
    quantity: number;
  }>;
}

export interface OrdersSnapshot {
  orders: Order[];
}

class HttpOrdersService {
  async list(): Promise<OrdersSnapshot> {
    const response = await fetch("/api/orders", {
      credentials: "include"
    });
    const body = await readSuccessfulJson(response);

    return {
      orders: Array.isArray(body.orders) ? (body.orders as Order[]) : []
    };
  }

  async create(input: OrderInput): Promise<Order> {
    const response = await fetch("/api/orders", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const body = await readSuccessfulJson(response);

    return body.order as Order;
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order> {
    const response = await fetch(`/api/orders/${id}/status`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });
    const body = await readSuccessfulJson(response);

    return body.order as Order;
  }
}

async function readSuccessfulJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Error.");
  }

  return body;
}

export const orderServices = {
  orders: new HttpOrdersService()
};
