import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState, ErrorState, LoadingState } from "./state";

describe("state components", () => {
  it("LoadingState_WhenRendered_ShouldExposeBusyStatus", () => {
    const { container } = render(<LoadingState title="Cargando datos" />);

    expect(container.querySelector("[aria-busy='true']")).toBeInTheDocument();
    expect(screen.getByText("Cargando datos")).toBeInTheDocument();
  });

  it("EmptyState_WhenActionIsProvided_ShouldCallAction", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <EmptyState
        title="Sin datos"
        message="No hay informacion."
        actionLabel="Reintentar"
        onAction={onAction}
      />
    );

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("ErrorState_WhenRendered_ShouldUseAlertRole", () => {
    render(<ErrorState title="Error de lectura" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Error de lectura");
  });
});
