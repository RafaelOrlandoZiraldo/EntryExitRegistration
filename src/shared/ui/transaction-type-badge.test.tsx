import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TransactionTypeBadge } from "./transaction-type-badge";

describe("TransactionTypeBadge", () => {
  it("TransactionTypeBadge_WhenIncome_ShouldRenderTextLabel", () => {
    render(<TransactionTypeBadge type="income" />);

    expect(screen.getByText("Ingreso")).toBeInTheDocument();
  });

  it("TransactionTypeBadge_WhenExpense_ShouldRenderTextLabel", () => {
    render(<TransactionTypeBadge type="expense" />);

    expect(screen.getByText("Egreso")).toBeInTheDocument();
  });
});
