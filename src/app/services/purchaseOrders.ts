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
  status: Exclude<PurchaseOrderStatus, "cancelled">;
  paymentTerms?: string;
  notes?: string;
  items: PurchaseOrderItemInput[];
}

export interface PurchaseOrdersSnapshot {
  orders: PurchaseOrder[];
}

class HttpPurchaseOrdersService {
  async list(): Promise<PurchaseOrdersSnapshot> {
    const response = await fetch("/api/purchase-orders", {
      credentials: "include"
    });
    const body = await readSuccessfulJson(response);

    return {
      orders: Array.isArray(body.orders) ? (body.orders as PurchaseOrder[]) : []
    };
  }

  async create(input: PurchaseOrderInput): Promise<PurchaseOrder> {
    const response = await fetch("/api/purchase-orders", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const body = await readSuccessfulJson(response);

    return body.order as PurchaseOrder;
  }

  async updateStatus(
    id: string,
    status: Exclude<PurchaseOrderStatus, "draft">
  ): Promise<PurchaseOrder> {
    const response = await fetch(`/api/purchase-orders/${id}/status`, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status })
    });
    const body = await readSuccessfulJson(response);

    return body.order as PurchaseOrder;
  }
}

async function readSuccessfulJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Error.");
  }

  return body;
}

export const purchaseOrderServices = {
  purchaseOrders: new HttpPurchaseOrdersService()
};
