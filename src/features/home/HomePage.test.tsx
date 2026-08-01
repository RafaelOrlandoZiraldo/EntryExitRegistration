import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { HomePage } from "./HomePage";

describe("HomePage", () => {
  it("HomePage_WhenRendered_ShouldShowTemporaryRoute", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: /registro domestico de ingresos y egresos/i
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Sin movimientos registrados")).toBeInTheDocument();
    expect(screen.getByText("Ingreso")).toBeInTheDocument();
    expect(screen.getByText("Egreso")).toBeInTheDocument();
  });
});
