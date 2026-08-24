export interface Supplier {
  id: string;
  name: string;
  taxId?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  paymentTerms?: string;
  bankAccount?: string;
  category?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface SupplierInput {
  name: string;
  taxId?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  paymentTerms?: string;
  bankAccount?: string;
  category?: string;
  notes?: string;
  active?: boolean;
}

export interface SuppliersSnapshot {
  suppliers: Supplier[];
}

class HttpSuppliersService {
  async list(): Promise<SuppliersSnapshot> {
    const response = await fetch("/api/suppliers", {
      credentials: "include"
    });
    const body = await readSuccessfulJson(response);

    return {
      suppliers: Array.isArray(body.suppliers)
        ? (body.suppliers as Supplier[])
        : []
    };
  }

  async create(input: SupplierInput): Promise<Supplier> {
    const response = await fetch("/api/suppliers", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const body = await readSuccessfulJson(response);

    return body.supplier as Supplier;
  }

  async update(id: string, input: SupplierInput): Promise<Supplier> {
    const response = await fetch(`/api/suppliers/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const body = await readSuccessfulJson(response);

    return body.supplier as Supplier;
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(`/api/suppliers/${id}`, {
      method: "DELETE",
      credentials: "include"
    });

    await readSuccessfulJson(response);
  }
}

async function readSuccessfulJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Error.");
  }

  return body;
}

export const supplierServices = {
  suppliers: new HttpSuppliersService()
};
