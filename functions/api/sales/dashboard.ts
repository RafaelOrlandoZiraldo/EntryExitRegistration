import { requireSession } from "../../_shared/auth";
import { jsonResponse, methodNotAllowed } from "../../_shared/http";
import { getSalesProfile } from "../../_shared/salesProfiles";
import type { PagesContext } from "../../_shared/types";

interface SalesSummaryRow {
  total_amount: number | null;
  order_count: number;
}

export async function onRequestGet({ request, env }: PagesContext) {
  const auth = await requireSession(request, env);

  if (!auth.ok) {
    return auth.response;
  }

  if (auth.session.role !== "seller") {
    return jsonResponse({ error: "Forbidden." }, { status: 403 });
  }

  const profile = await getSalesProfile(env.DB, auth.session.userId);
  const today = new Date();
  const monthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  )
    .toISOString()
    .slice(0, 10);
  const nextMonthStart = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1)
  )
    .toISOString()
    .slice(0, 10);

  const month = await summarizeSales(
    env.DB,
    auth.session.userId,
    monthStart,
    nextMonthStart
  );
  const allTime = await summarizeSales(env.DB, auth.session.userId);
  const commissionRate = profile?.commissionRate ?? 0;
  const bonusGoalAmount = profile?.bonusGoalAmount ?? 0;
  const bonusAmount = profile?.bonusAmount ?? 0;
  const monthlyCommission = roundMoney(month.totalAmount * (commissionRate / 100));
  const monthlyBonus =
    bonusGoalAmount > 0 && month.totalAmount >= bonusGoalAmount
      ? bonusAmount
      : 0;

  return jsonResponse({
    dashboard: {
      seller: {
        id: auth.session.userId,
        username: auth.session.username
      },
      profile: profile ?? {
        userId: auth.session.userId,
        catalogUserId: auth.session.userId,
        commissionRate: 0,
        bonusGoalAmount: 0,
        bonusAmount: 0,
        createdAt: "",
        updatedAt: ""
      },
      month: {
        startsAt: monthStart,
        totalAmount: month.totalAmount,
        orderCount: month.orderCount,
        averageOrderAmount:
          month.orderCount > 0
            ? roundMoney(month.totalAmount / month.orderCount)
            : 0,
        commissionAmount: monthlyCommission,
        bonusAmount: monthlyBonus,
        estimatedPayout: roundMoney(monthlyCommission + monthlyBonus),
        goalProgress:
          bonusGoalAmount > 0
            ? Math.min(100, roundMoney((month.totalAmount / bonusGoalAmount) * 100))
            : 0
      },
      allTime
    }
  });
}

export function onRequest() {
  return methodNotAllowed();
}

async function summarizeSales(
  db: D1Database,
  userId: string,
  startDate?: string,
  endDate?: string
) {
  const statement =
    startDate && endDate
      ? db
          .prepare(
            `SELECT COALESCE(SUM(total_amount), 0) AS total_amount,
                    COUNT(*) AS order_count
             FROM orders
             WHERE user_id = ?
               AND status <> 'cancelled'
               AND date(created_at) >= date(?)
               AND date(created_at) < date(?)`
          )
          .bind(userId, startDate, endDate)
      : db
          .prepare(
            `SELECT COALESCE(SUM(total_amount), 0) AS total_amount,
                    COUNT(*) AS order_count
             FROM orders
             WHERE user_id = ? AND status <> 'cancelled'`
          )
          .bind(userId);

  const row = await statement.first<SalesSummaryRow>();

  return {
    totalAmount: row?.total_amount ?? 0,
    orderCount: row?.order_count ?? 0
  };
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
