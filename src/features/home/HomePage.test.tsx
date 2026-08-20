import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HomePage } from "./HomePage";

describe("HomePage", () => {
  it("HomePage_WhenRendered_ShouldShowDashboardSummary", async () => {
    render(
      <MemoryRouter>
        <HomePage
          catalogService={{
            list: () => Promise.resolve({
              categories: [],
              articles: []
            })
          }}
          getTransactionsUseCase={{
            execute: () => Promise.resolve([])
          }}
          inventoryService={{
            list: () => Promise.resolve({
              items: [],
              movements: []
            })
          }}
          ordersService={{
            list: () => Promise.resolve({
              orders: []
            })
          }}
        />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: /dashboard general/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Sin informacion cargada")).toBeInTheDocument();
  });
});
