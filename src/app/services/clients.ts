export interface Client {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface ClientInput {
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  active?: boolean;
}

export interface ClientsSnapshot {
  clients: Client[];
}

class HttpClientsService {
  async list(): Promise<ClientsSnapshot> {
    const response = await fetch("/api/clients", {
      credentials: "include"
    });
    const body = await readSuccessfulJson(response);

    return {
      clients: Array.isArray(body.clients) ? (body.clients as Client[]) : []
    };
  }

  async create(input: ClientInput): Promise<Client> {
    const response = await fetch("/api/clients", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const body = await readSuccessfulJson(response);

    return body.client as Client;
  }

  async update(id: string, input: ClientInput): Promise<Client> {
    const response = await fetch(`/api/clients/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });
    const body = await readSuccessfulJson(response);

    return body.client as Client;
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(`/api/clients/${id}`, {
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

export const clientServices = {
  clients: new HttpClientsService()
};
