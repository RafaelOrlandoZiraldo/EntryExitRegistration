import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { TransactionType } from "@domain/transactions";
import { cn } from "@shared/lib/utils";

export function TransactionTypeBadge({ type }: { type: TransactionType }) {
  const isIncome = type === "income";
  const Icon = isIncome ? ArrowUpRight : ArrowDownLeft;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
        isIncome
          ? "border-success/30 bg-success/10 text-success"
          : "border-warning/40 bg-warning/15 text-warning-foreground"
      )}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      {isIncome ? "Ingreso" : "Egreso"}
    </span>
  );
}
