import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { StorageDocument } from "@domain/storage";
import type { FinancialTransaction } from "@domain/transactions";
import { TransactionsPage } from "./TransactionsPage";

const transactions: FinancialTransaction[] = [
  {
    id: "transaction-1",
    type: "income",
    date: "2026-08-01",
    amount: 1500,
    category: "salary",
    description: "Sueldo",
    paymentMethod: "bank_transfer",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z"
  },
  {
    id: "transaction-2",
    type: "expense",
    date: "2026-08-02",
    amount: 320.5,
    category: "groceries",
    description: "Supermercado",
    paymentMethod: "debit_card",
    createdAt: "2026-08-02T10:00:00.000Z",
    updatedAt: "2026-08-02T10:00:00.000Z"
  }
];

describe("TransactionsPage", () => {
  it("TransactionsPage_WhenTransactionsLoad_ShouldRenderFormattedRows", async () => {
    render(
      <TransactionsPage
        {...createUseCases({ transactions })}
      />
    );

    expect(await screen.findAllByText("Sueldo")).not.toHaveLength(0);
    expect(screen.getAllByText("01/08/2026")).not.toHaveLength(0);
    expect(screen.getAllByText("Ingreso")).not.toHaveLength(0);
    expect(screen.getAllByText("Sueldo")).not.toHaveLength(0);
    expect(screen.getAllByText("Transferencia")).not.toHaveLength(0);
    expect(screen.getAllByText(/\$\s1\.500,00/)).not.toHaveLength(0);
    expect(screen.getAllByText("Supermercado")).not.toHaveLength(0);
    expect(screen.getAllByText(/\$\s320,50/)).not.toHaveLength(0);
  });

  it("TransactionsPage_WhenNoTransactionsExist_ShouldRenderEmptyState", async () => {
    render(
      <TransactionsPage
        {...createUseCases({ transactions: [] })}
      />
    );

    expect(
      await screen.findByText("Sin movimientos registrados")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Todavia no hay ingresos ni egresos guardados.")
    ).toBeInTheDocument();
  });

  it("TransactionsPage_WhenLoadingFails_ShouldRenderErrorAndRetry", async () => {
    const execute = vi
      .fn<() => Promise<FinancialTransaction[]>>()
      .mockRejectedValueOnce(new Error("read failed"))
      .mockResolvedValueOnce(transactions);
    const user = userEvent.setup();
    render(
      <TransactionsPage
        {...createUseCases({ execute })}
      />
    );

    expect(
      await screen.findByText("No se pudieron cargar los movimientos")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findAllByText("Sueldo")).not.toHaveLength(0);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("TransactionsPage_WhenRenderedOnMobile_ShouldExposeActionNamesWithContext", async () => {
    render(
      <TransactionsPage
        {...createUseCases({ transactions })}
      />
    );

    await screen.findAllByText("Sueldo");
    expect(
      screen.getAllByRole("button", { name: "Editar movimiento Sueldo" })
    ).not.toHaveLength(0);
    expect(
      screen.getAllByRole("button", { name: "Eliminar movimiento Sueldo" })
    ).not.toHaveLength(0);
  });

  it("TransactionsPage_WhenCreateSucceeds_ShouldReloadFromSingleSourceOfTruth", async () => {
    const user = userEvent.setup();
    const createdTransaction: FinancialTransaction = {
      ...transactions[1],
      id: "created-id",
      description: "Nueva compra"
    };
    const execute = vi
      .fn<() => Promise<FinancialTransaction[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createdTransaction]);
    const createExecute = vi.fn(() => Promise.resolve(createdTransaction));
    render(
      <TransactionsPage
        {...createUseCases({
          execute,
          createExecute
        })}
      />
    );

    await screen.findByText("Sin movimientos registrados");
    await user.click(
      screen.getAllByRole("button", { name: "Nuevo movimiento" })[0]
    );
    await fillTransactionForm(user, {
      description: "Nueva compra"
    });
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findAllByText("Nueva compra")).not.toHaveLength(0);
    expect(
      within(
        screen.getByRole("region", { name: "Indicadores financieros" })
      ).getAllByText(/\$\s320,50/)
    ).not.toHaveLength(0);
    expect(createExecute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("TransactionsPage_WhenEditSucceeds_ShouldUpdateAndReloadFromSingleSourceOfTruth", async () => {
    const user = userEvent.setup();
    const updatedTransaction: FinancialTransaction = {
      ...transactions[0],
      description: "Sueldo editado"
    };
    const execute = vi
      .fn<() => Promise<FinancialTransaction[]>>()
      .mockResolvedValueOnce([transactions[0]])
      .mockResolvedValueOnce([updatedTransaction]);
    const updateExecute = vi.fn(() => Promise.resolve(updatedTransaction));
    render(
      <TransactionsPage
        {...createUseCases({
          execute,
          updateExecute
        })}
      />
    );

    await screen.findAllByText("Sueldo");
    await user.click(
      screen.getAllByRole("button", { name: "Editar movimiento Sueldo" })[0]
    );
    await user.clear(screen.getByLabelText("Descripcion"));
    await user.type(screen.getByLabelText("Descripcion"), "Sueldo editado");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(updateExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "transaction-1",
          description: "Sueldo editado"
        })
      );
    });
    expect(await screen.findAllByText("Sueldo editado")).not.toHaveLength(0);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("TransactionsPage_WhenDeleteSucceeds_ShouldWaitForPersistenceAndReload", async () => {
    const user = userEvent.setup();
    const execute = vi
      .fn<() => Promise<FinancialTransaction[]>>()
      .mockResolvedValueOnce([transactions[1]])
      .mockResolvedValueOnce([]);
    const deleteExecute = vi.fn(() => Promise.resolve());
    render(
      <TransactionsPage
        {...createUseCases({
          execute,
          deleteExecute
        })}
      />
    );

    await screen.findAllByText("Supermercado");
    await user.click(
      screen.getAllByRole("button", {
        name: "Eliminar movimiento Supermercado"
      })[0]
    );
    expect(screen.getAllByText("Supermercado")).not.toHaveLength(0);

    await user.click(
      screen.getByRole("button", { name: "Eliminar definitivamente" })
    );

    await waitFor(() => {
      expect(deleteExecute).toHaveBeenCalledWith("transaction-2");
    });
    expect(
      await screen.findByText("Sin movimientos registrados")
    ).toBeInTheDocument();
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("TransactionsPage_WhenDeleteFails_ShouldKeepTransactionAndShowFeedback", async () => {
    const user = userEvent.setup();
    const deleteExecute = vi.fn(() => Promise.reject(new Error("delete failed")));
    render(
      <TransactionsPage
        {...createUseCases({
          transactions: [transactions[1]],
          deleteExecute
        })}
      />
    );

    await screen.findAllByText("Supermercado");
    await user.click(
      screen.getAllByRole("button", {
        name: "Eliminar movimiento Supermercado"
      })[0]
    );
    await user.click(
      screen.getByRole("button", { name: "Eliminar definitivamente" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo completar la operacion."
    );
    expect(screen.getAllByText("Supermercado")).not.toHaveLength(0);
  });

  it("TransactionsPage_WhenFiltersAreApplied_ShouldCombineCriteriaWithAndLogic", async () => {
    const user = userEvent.setup();
    render(
      <TransactionsPage
        {...createUseCases({
          transactions
        })}
      />
    );

    await screen.findAllByText("Supermercado");
    await user.selectOptions(screen.getByLabelText("Tipo"), "expense");
    await user.selectOptions(screen.getByLabelText("Categoria"), "groceries");
    await user.selectOptions(screen.getByLabelText("Medio de pago"), "debit_card");
    await user.type(screen.getByLabelText("Texto"), "super");
    await user.type(screen.getByLabelText("Importe minimo"), "100");
    await user.type(screen.getByLabelText("Importe maximo"), "400");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(screen.getAllByText("Supermercado")).not.toHaveLength(0);
    const dashboard = within(
      screen.getByRole("region", { name: "Indicadores financieros" })
    );
    expect(dashboard.getAllByText(/\$\s320,50/)).not.toHaveLength(0);
    expect(dashboard.getByText("1")).toBeInTheDocument();
    expect(screen.queryByText(/\$\s1\.500,00/)).not.toBeInTheDocument();
  });

  it("TransactionsPage_WhenFiltersMatchNothing_ShouldDistinguishFilteredEmptyState", async () => {
    const user = userEvent.setup();
    render(
      <TransactionsPage
        {...createUseCases({
          transactions
        })}
      />
    );

    await screen.findAllByText("Sueldo");
    await user.type(screen.getByLabelText("Texto"), "no existe");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(
      await screen.findByText("Sin resultados para los filtros")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Todavia no hay ingresos ni egresos guardados.")
    ).not.toBeInTheDocument();
  });

  it("TransactionsPage_WhenFilterRangeIsInvalid_ShouldKeepPreviousVisibleResults", async () => {
    const user = userEvent.setup();
    render(
      <TransactionsPage
        {...createUseCases({
          transactions
        })}
      />
    );

    await screen.findAllByText("Sueldo");
    await user.type(screen.getByLabelText("Importe minimo"), "500");
    await user.type(screen.getByLabelText("Importe maximo"), "100");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(screen.getByText("Revisar el rango de importes.")).toBeInTheDocument();
    expect(screen.getAllByText("Sueldo")).not.toHaveLength(0);
    expect(screen.getAllByText("Supermercado")).not.toHaveLength(0);
  });

  it("TransactionsPage_WhenClearFiltersIsClicked_ShouldRestoreAllRows", async () => {
    const user = userEvent.setup();
    render(
      <TransactionsPage
        {...createUseCases({
          transactions
        })}
      />
    );

    await screen.findAllByText("Sueldo");
    await user.selectOptions(screen.getByLabelText("Tipo"), "income");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(screen.queryByText(/\$\s320,50/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));

    expect(screen.getAllByText("Supermercado")).not.toHaveLength(0);
  });

  it("TransactionsPage_WhenSortingByAmountAscending_ShouldReorderVisibleRows", async () => {
    const user = userEvent.setup();
    render(
      <TransactionsPage
        {...createUseCases({
          transactions
        })}
      />
    );

    await screen.findAllByText("Sueldo");
    await user.selectOptions(screen.getByLabelText("Ordenar por"), "amount");
    await user.selectOptions(screen.getByLabelText("Direccion"), "asc");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    const rows = screen.getAllByRole("row");

    expect(rows[1]).toHaveTextContent("Supermercado");
    expect(rows[2]).toHaveTextContent("Sueldo");
  });

  it("TransactionsPage_WhenExportIsClicked_ShouldDownloadCompleteDocumentWithoutReloading", async () => {
    const user = userEvent.setup();
    const download = vi.fn();
    const exportExecute = vi.fn(() =>
      Promise.resolve({
        fileName: "domestic-finance-2026-08-20.json",
        contents: "{\"schemaVersion\":1}\n",
        document: createStorageDocument(transactions)
      })
    );
    const execute = vi.fn(() => Promise.resolve(transactions));
    render(
      <TransactionsPage
        {...createUseCases({
          execute,
          exportExecute,
          download
        })}
      />
    );

    await screen.findAllByText("Sueldo");
    await user.click(screen.getByRole("button", { name: "Exportar JSON" }));

    expect(download).toHaveBeenCalledWith({
      fileName: "domestic-finance-2026-08-20.json",
      contents: "{\"schemaVersion\":1}\n",
      mimeType: "application/json"
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("TransactionsPage_WhenValidImportIsConfirmed_ShouldBackupReplaceAndReload", async () => {
    const user = userEvent.setup();
    const importedTransactions: FinancialTransaction[] = [
      {
        ...transactions[0],
        id: "imported-id",
        description: "Movimiento importado"
      }
    ];
    const importedDocument = createStorageDocument(importedTransactions);
    const execute = vi
      .fn<() => Promise<FinancialTransaction[]>>()
      .mockResolvedValueOnce(transactions)
      .mockResolvedValueOnce(importedTransactions);
    const importExecute = vi.fn(() => Promise.resolve(importedDocument));
    const download = vi.fn();
    render(
      <TransactionsPage
        {...createUseCases({
          execute,
          importExecute,
          download
        })}
      />
    );

    await screen.findAllByText("Sueldo");
    await user.upload(
      screen.getByLabelText("Seleccionar respaldo JSON"),
      new File([JSON.stringify(importedDocument)], "backup.json", {
        type: "application/json"
      })
    );
    expect(
      await screen.findByRole("dialog", { name: "Confirmar importacion" })
    ).toBeInTheDocument();
    expect(screen.getByText("Version")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Descargar respaldo y reemplazar" })
    );

    expect(download).toHaveBeenCalled();
    expect(importExecute).toHaveBeenCalledWith(JSON.stringify(importedDocument));
    expect(await screen.findAllByText("Movimiento importado")).not.toHaveLength(0);
    expect(
      screen
        .queryAllByRole("row")
        .some((row) => row.textContent?.includes("Supermercado"))
    ).toBe(false);
  });

  it("TransactionsPage_WhenImportFileIsInvalid_ShouldShowRecoverableErrorAndKeepCurrentData", async () => {
    const user = userEvent.setup();
    const importExecute = vi.fn();
    render(
      <TransactionsPage
        {...createUseCases({
          transactions,
          importExecute
        })}
      />
    );

    await screen.findAllByText("Sueldo");
    await user.upload(
      screen.getByLabelText("Seleccionar respaldo JSON"),
      new File(["{bad-json"], "bad.json", { type: "application/json" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Importacion invalida"
    );
    expect(importExecute).not.toHaveBeenCalled();
    expect(screen.getAllByText("Sueldo")).not.toHaveLength(0);
  });

  it("TransactionsPage_WhenLocalDataCannotLoad_ShouldOfferRecoveryImport", async () => {
    const user = userEvent.setup();
    const recoveredTransactions: FinancialTransaction[] = [
      {
        ...transactions[0],
        id: "recovered-id",
        description: "Movimiento recuperado"
      }
    ];
    const recoveredDocument = createStorageDocument(recoveredTransactions);
    const execute = vi
      .fn<() => Promise<FinancialTransaction[]>>()
      .mockRejectedValueOnce(new Error("corrupted"))
      .mockResolvedValueOnce(recoveredTransactions);
    const importExecute = vi.fn(() => Promise.resolve(recoveredDocument));
    render(
      <TransactionsPage
        {...createUseCases({
          execute,
          importExecute
        })}
      />
    );

    expect(await screen.findByText("Recuperar desde respaldo")).toBeInTheDocument();
    await user.upload(
      screen.getByLabelText("Seleccionar respaldo JSON"),
      new File([JSON.stringify(recoveredDocument)], "recovery.json", {
        type: "application/json"
      })
    );
    await user.click(
      await screen.findByRole("button", {
        name: "Reemplazar con respaldo importado"
      })
    );

    expect(importExecute).toHaveBeenCalledWith(JSON.stringify(recoveredDocument));
    expect(await screen.findAllByText("Movimiento recuperado")).not.toHaveLength(0);
  });
});

function createUseCases({
  transactions: providedTransactions = [],
  execute = () => Promise.resolve(providedTransactions),
  createExecute = (input: unknown) =>
    Promise.resolve({
      id: "created-id",
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
      ...(input as object)
    } as FinancialTransaction),
  updateExecute = (input: unknown) =>
    Promise.resolve({
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-02T10:00:00.000Z",
      ...(input as object)
    } as FinancialTransaction),
  deleteExecute = () => Promise.resolve(),
  exportExecute = () =>
    Promise.resolve({
      fileName: "domestic-finance-2026-08-01.json",
      contents: `${JSON.stringify(createStorageDocument(providedTransactions), null, 2)}\n`,
      document: createStorageDocument(providedTransactions)
    }),
  previewExecute = (contents: string) => {
    const document = JSON.parse(contents) as StorageDocument;

    if (document.schemaVersion !== 1 || !Array.isArray(document.transactions)) {
      throw new Error("Importacion invalida");
    }

    return {
      schemaVersion: document.schemaVersion,
      transactionCount: document.transactions.length,
      document
    };
  },
  importExecute = () => Promise.resolve(createStorageDocument(providedTransactions)),
  download = vi.fn(),
  mapError = (error: unknown) => {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && error.message.includes("Importacion"))
    ) {
      return {
        title: "Importacion invalida",
        message: "El archivo seleccionado no coincide con el formato esperado."
      };
    }

    if (
      error instanceof Error &&
      (error.message.includes("read failed") ||
        error.message.includes("corrupted"))
    ) {
      return {
        title: "No se pudieron cargar los movimientos",
        message: "La lectura del archivo local no se pudo completar."
      };
    }

    return {
      title: "Error inesperado",
      message: "No se pudo completar la operacion."
    };
  }
}: {
  transactions?: FinancialTransaction[];
  execute?: () => Promise<FinancialTransaction[]>;
  createExecute?: (input: unknown) => Promise<FinancialTransaction>;
  updateExecute?: (input: unknown) => Promise<FinancialTransaction>;
  deleteExecute?: (id: string) => Promise<void>;
  exportExecute?: () => Promise<{
    fileName: string;
    contents: string;
    document: StorageDocument;
  }>;
  previewExecute?: (contents: string) => {
    schemaVersion: number;
    transactionCount: number;
    document: StorageDocument;
  };
  importExecute?: (contents: string) => Promise<StorageDocument>;
  download?: (file: { fileName: string; contents: string; mimeType?: string }) => void;
  mapError?: (error: unknown) => { title: string; message: string };
}) {
  return {
    getTransactionsUseCase: {
      execute
    },
    createTransactionUseCase: {
      execute: createExecute
    },
    updateTransactionUseCase: {
      execute: updateExecute
    },
    deleteTransactionUseCase: {
      execute: deleteExecute
    },
    exportStorageDocumentUseCase: {
      execute: exportExecute
    },
    previewImportStorageDocumentUseCase: {
      execute: previewExecute
    },
    importStorageDocumentUseCase: {
      execute: importExecute
    },
    downloadFile: {
      download
    },
    mapError
  };
}

function createStorageDocument(
  documentTransactions: FinancialTransaction[]
): StorageDocument {
  return {
    schemaVersion: 1,
    lastUpdatedAt: "2026-08-01T15:30:00.000Z",
    transactions: documentTransactions
  };
}

async function fillTransactionForm(
  user: ReturnType<typeof userEvent.setup>,
  { description }: { description: string }
) {
  const dialog = within(screen.getByRole("dialog"));

  await user.clear(dialog.getByLabelText("Fecha"));
  await user.type(dialog.getByLabelText("Fecha"), "2026-08-05");
  await user.clear(dialog.getByLabelText("Importe"));
  await user.type(dialog.getByLabelText("Importe"), "250.75");
  await user.selectOptions(dialog.getByLabelText("Categoria"), "groceries");
  await user.type(dialog.getByLabelText("Descripcion"), description);
  await user.selectOptions(dialog.getByLabelText("Medio de pago"), "debit_card");
}
