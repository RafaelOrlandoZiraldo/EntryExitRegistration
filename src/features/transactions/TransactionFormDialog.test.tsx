import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { StorageWriteError } from "@infrastructure/storage";
import type { FinancialTransaction } from "@domain/transactions";
import { TransactionFormDialog } from "./TransactionFormDialog";

const transaction: FinancialTransaction = {
  id: "transaction-1",
  type: "income",
  date: "2026-08-01",
  amount: 1500,
  category: "salary",
  description: "Sueldo",
  paymentMethod: "bank_transfer",
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-01T10:00:00.000Z"
};

describe("TransactionFormDialog", () => {
  it("TransactionFormDialog_WhenAmountIsZero_ShouldShowValidationMessage", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.clear(screen.getByLabelText("Importe"));
    await user.type(screen.getByLabelText("Importe"), "0");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText("El importe debe ser mayor que cero.")
    ).toBeInTheDocument();
  });

  it("TransactionFormDialog_WhenDescriptionIsWhitespace_ShouldShowValidationMessage", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Descripcion"), "   ");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText("Ingresar una descripcion.")
    ).toBeInTheDocument();
  });

  it("TransactionFormDialog_WhenTypeChanges_ShouldClearIncompatibleCategory", async () => {
    const user = userEvent.setup();
    renderDialog({ mode: "edit", transaction });

    expect(screen.getByLabelText("Categoria")).toHaveValue("salary");

    await user.selectOptions(screen.getByLabelText("Tipo"), "expense");

    expect(screen.getByLabelText("Categoria")).toHaveValue("rent");
  });

  it("TransactionFormDialog_WhenCreateSucceeds_ShouldSubmitAndCloseAfterRefresh", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(() => Promise.resolve());
    const onSuccess = vi.fn(() => Promise.resolve());
    const onOpenChange = vi.fn();
    renderDialog({ onCreate, onSuccess, onOpenChange });

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({
        type: "expense",
        date: "2026-08-05",
        amount: 250.75,
        category: "groceries",
        description: "Supermercado",
        paymentMethod: "debit_card"
      });
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("TransactionFormDialog_WhenEditSucceeds_ShouldSubmitIdAndCloseAfterRefresh", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn(() => Promise.resolve());
    const onSuccess = vi.fn(() => Promise.resolve());
    const onOpenChange = vi.fn();
    renderDialog({
      mode: "edit",
      transaction,
      onUpdate,
      onSuccess,
      onOpenChange
    });

    await user.clear(screen.getByLabelText("Descripcion"));
    await user.type(screen.getByLabelText("Descripcion"), "Sueldo editado");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "transaction-1",
          description: "Sueldo editado"
        })
      );
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("TransactionFormDialog_WhenPersistenceFails_ShouldStayOpenWithFeedback", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn(() =>
      Promise.reject(new StorageWriteError())
    );
    const onOpenChange = vi.fn();
    renderDialog({ onCreate, onOpenChange });

    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La operacion no fue confirmada en el almacenamiento local."
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.clear(screen.getByLabelText("Fecha"));
  await user.type(screen.getByLabelText("Fecha"), "2026-08-05");
  await user.clear(screen.getByLabelText("Importe"));
  await user.type(screen.getByLabelText("Importe"), "250.75");
  await user.selectOptions(screen.getByLabelText("Categoria"), "groceries");
  await user.type(screen.getByLabelText("Descripcion"), "Supermercado");
  await user.selectOptions(screen.getByLabelText("Medio de pago"), "debit_card");
}

function renderDialog({
  mode = "create",
  transaction: providedTransaction,
  onCreate = vi.fn(() => Promise.resolve()),
  onUpdate = vi.fn(() => Promise.resolve()),
  onSuccess = vi.fn(() => Promise.resolve()),
  onOpenChange = vi.fn(),
  mapError = () => ({
    message: "La operacion no fue confirmada en el almacenamiento local."
  })
}: Partial<ComponentProps<typeof TransactionFormDialog>> = {}) {
  render(
    <TransactionFormDialog
      mode={mode}
      open
      transaction={providedTransaction}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onSuccess={onSuccess}
      onOpenChange={onOpenChange}
      mapError={mapError}
    />
  );
}
