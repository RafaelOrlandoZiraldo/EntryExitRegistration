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

export interface InventorySnapshot {
  items: InventoryItem[];
  movements: InventoryMovement[];
}

export interface InventoryMovementInput {
  articleId: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string;
  notes?: string;
}

class HttpInventoryService {
  async list(): Promise<InventorySnapshot> {
    const response = await fetch("/api/inventory", {
      credentials: "include"
    });
    const body = await readSuccessfulJson(response);

    return {
      items: Array.isArray(body.items) ? (body.items as InventoryItem[]) : [],
      movements: Array.isArray(body.movements)
        ? (body.movements as InventoryMovement[])
        : []
    };
  }

  async createMovement(
    input: InventoryMovementInput
  ): Promise<InventoryMovement> {
    const response = await fetch("/api/inventory/movements", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const body = await readSuccessfulJson(response);

    return body.movement as InventoryMovement;
  }
}

async function readSuccessfulJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Error.");
  }

  return body;
}

export const inventoryServices = {
  inventory: new HttpInventoryService()
};
