import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

function ThrowingChild() {
  throw new Error("password=super-secret");
}

describe("AppErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("AppErrorBoundary_WhenChildThrows_ShouldRenderGenericUnexpectedError", () => {
    render(
      <AppErrorBoundary>
        <ThrowingChild />
      </AppErrorBoundary>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Error inesperado");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No se pudo completar la operacion."
    );
    expect(screen.queryByText(/super-secret/i)).not.toBeInTheDocument();
  });
});
