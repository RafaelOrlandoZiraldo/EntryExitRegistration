export type UserRole = "admin" | "user" | "seller";

export interface SalesProfile {
  userId: string;
  catalogUserId: string;
  commissionRate: number;
  bonusGoalAmount: number;
  bonusAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalesProfileInput {
  catalogUserId: string;
  commissionRate: number;
  bonusGoalAmount: number;
  bonusAmount: number;
}

export interface AppUser {
  id: string;
  username: string;
  role: UserRole;
  createdAt: string;
  salesProfile?: SalesProfile | null;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role: UserRole;
  salesProfile?: SalesProfileInput;
}

class HttpUserService {
  async list(): Promise<AppUser[]> {
    const response = await fetch("/api/users", {
      credentials: "include"
    });

    const body = await readSuccessfulJson(response);

    return Array.isArray(body.users) ? (body.users as AppUser[]) : [];
  }

  async create(input: CreateUserInput): Promise<AppUser> {
    const response = await fetch("/api/users", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    const body = await readSuccessfulJson(response);

    return body.user as AppUser;
  }

  async updateSalesProfile(
    id: string,
    input: SalesProfileInput
  ): Promise<SalesProfile> {
    const response = await fetch(`/api/users/${id}/sales-profile`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    const body = await readSuccessfulJson(response);

    return body.salesProfile as SalesProfile;
  }
}

async function readSuccessfulJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Error.");
  }

  return body;
}

export const userServices = {
  users: new HttpUserService()
};
