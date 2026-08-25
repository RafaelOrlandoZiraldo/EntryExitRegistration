export interface SalesProfile {
  userId: string;
  catalogUserId: string;
  commissionRate: number;
  bonusGoalAmount: number;
  bonusAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalesDashboard {
  seller: {
    id: string;
    username: string;
  };
  profile: SalesProfile;
  month: {
    startsAt: string;
    totalAmount: number;
    orderCount: number;
    averageOrderAmount: number;
    commissionAmount: number;
    bonusAmount: number;
    estimatedPayout: number;
    goalProgress: number;
  };
  allTime: {
    totalAmount: number;
    orderCount: number;
  };
}

class HttpSalesService {
  async dashboard(): Promise<SalesDashboard> {
    const response = await fetch("/api/sales/dashboard", {
      credentials: "include"
    });
    const body = await readSuccessfulJson(response);

    return body.dashboard as SalesDashboard;
  }
}

async function readSuccessfulJson(response: Response) {
  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Error.");
  }

  return body;
}

export const salesServices = {
  sales: new HttpSalesService()
};
