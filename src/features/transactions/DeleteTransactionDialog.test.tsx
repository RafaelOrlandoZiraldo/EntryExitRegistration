import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { StorageWriteError } from "@infrastructure/storage";
import type { FinancialTransaction } from "@domain/transactions";
import { DeleteTransactionDialog } from "./DeleteTransactionDialog";

const transaction: FinancialTransaction = {
  id: "transaction-1",
  type: "expense",
  date: "2026-08-10",
  amount: 450.25,
  category: "groceries",
  description: "Supermercado",
  paymentMethod: "debit_card",
  createdAt: "2026-08-10T10:00:00.000Z",
  updatedAt: "2026-08-10T10:00:00.000Z"
};

describe("DeleteTransactionDialog", () => {
  it("DeleteTransactionDialog_WhenOpened_ShouldShowRequiredContextAndWarning", () => {
    renderDialog();

    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Eliminar movimiento"
    );
    expect(screen.getByText("Egreso")).toBeInTheDocument();
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
    expect(screen.getByText("10/08/2026")).toBeInTheDocument();
    expect(screen.getByText(/\$\s450,25/)).toBeInTheDocument();
    expect(
      screen.getByText("Esta eliminacion es fisica y no se puede deshacer.")
    ).toBeInTheDocument();
  });

  it("DeleteTransactionDialog_WhenConfirmed_ShouldDeleteRefreshAndClose", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(() => Promise.resolve());
    const onSuccess = vi.fn(() => Promise.resolve());
    const onOpenChange = vi.fn();
    renderDialog({ onDelete, onSuccess, onOpenChange });

    await user.click(
      screen.getByRole("button", { name: "Eliminar definitivamente" })
    );

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("transaction-1");
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("DeleteTransactionDialog_WhenConfirmationIsRepeated_ShouldSubmitOnce", async () => {
    const user = userEvent.setup();
    let resolveDelete: (() => void) | undefined;
    const onDelete = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        })
    );
    renderDialog({ onDelete });
    const confirmButton = screen.getByRole("button", {
      name: "Eliminar definitivamente"
    });

    await user.dblClick(confirmButton);
    resolveDelete?.();

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  it("DeleteTransactionDialog_WhenDeleteFails_ShouldStayOpenWithFeedback", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn(() => Promise.reject(new StorageWriteError()));
    const onOpenChange = vi.fn();
    renderDialog({ onDelete, onOpenChange });

    await user.click(
      screen.getByRole("button", { name: "Eliminar definitivamente" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La operacion no fue confirmada en el almacenamiento local."
    );
    expect(screen.getByText("Supermercado")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

function renderDialog({
  open = true,
  transaction: providedTransaction = transaction,
  onOpenChange = vi.fn(),
  onDelete = vi.fn(() => Promise.resolve()),
  onSuccess = vi.fn(() => Promise.resolve()),
  mapError = () => ({
    message: "La operacion no fue confirmada en el almacenamiento local."
  })
}: Partial<ComponentProps<typeof DeleteTransactionDialog>> = {}) {
  render(
    <DeleteTransactionDialog
      open={open}
      transaction={providedTransaction}
      onOpenChange={onOpenChange}
      onDelete={onDelete}
      onSuccess={onSuccess}
      mapError={mapError}
    />
  );
}
