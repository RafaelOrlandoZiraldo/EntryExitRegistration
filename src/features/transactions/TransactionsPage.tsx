import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef
} from "@tanstack/react-table";
import { Edit, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CreateTransactionInput,
  ExportStorageDocumentResult,
  ImportPreview,
  UpdateTransactionInput
} from "@application/use-cases";
import type { FinancialTransaction } from "@domain/transactions";
import {
  searchTransactions,
  type TransactionFilters,
  type TransactionSort
} from "@domain/transactions";
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageTitle,
  TransactionTypeBadge
} from "@shared/ui";
import { DeleteAllTransactionsDialog } from "./DeleteAllTransactionsDialog";
import {
  formatTransactionAmount,
  formatTransactionDate,
  getCategoryLabel,
  getPaymentMethodLabel
} from "./formatters";
import { DeleteTransactionDialog } from "./DeleteTransactionDialog";
import { BackupRestoreControls } from "./BackupRestoreControls";
import {
  createEmptyTransactionFilterDraft,
  parseTransactionFilterDraft,
  type TransactionFilterDraft,
  type TransactionFilterErrors
} from "./transactionFilterForm";
import { createTransactionDashboardSelector } from "./transactionDashboardSelectors";
import { FinancialDashboard } from "./FinancialDashboard";
import { TransactionsFilterPanel } from "./TransactionsFilterPanel";
import { TransactionFormDialog } from "./TransactionFormDialog";

export interface TransactionsPageProps {
  getTransactionsUseCase: {
    execute(this: void): Promise<FinancialTransaction[]>;
  };
  createTransactionUseCase: {
    execute(input: CreateTransactionInput): Promise<FinancialTransaction>;
  };
  updateTransactionUseCase: {
    execute(input: UpdateTransactionInput): Promise<FinancialTransaction>;
  };
  deleteTransactionUseCase: {
    execute(id: string): Promise<void>;
  };
  deleteAllTransactionsUseCase: {
    execute(this: void): Promise<void>;
  };
  verifyPasswordUseCase: {
    execute(password: string): Promise<void>;
  };
  exportStorageDocumentUseCase: {
    execute(this: void): Promise<ExportStorageDocumentResult>;
  };
  previewImportStorageDocumentUseCase: {
    execute(this: void, contents: string): ImportPreview;
  };
  importStorageDocumentUseCase: {
    execute(this: void, contents: string): Promise<unknown>;
  };
  downloadFile: {
    download(
      this: void,
      file: { fileName: string; contents: string; mimeType?: string }
    ): void;
  };
  mapError(
    this: void,
    error: unknown
  ): { title: string; message: string; recoveryAction?: string };
}

type LoadState =
  | { status: "loading" }
  | { status: "success"; transactions: FinancialTransaction[] }
  | { status: "error"; error: unknown };

export function TransactionsPage({
  getTransactionsUseCase,
  createTransactionUseCase,
  updateTransactionUseCase,
  deleteTransactionUseCase,
  deleteAllTransactionsUseCase,
  verifyPasswordUseCase,
  exportStorageDocumentUseCase,
  previewImportStorageDocumentUseCase,
  importStorageDocumentUseCase,
  downloadFile,
  mapError
}: TransactionsPageProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [formState, setFormState] = useState<FormState>({ status: "closed" });
  const [deleteState, setDeleteState] = useState<DeleteState>({
    status: "closed"
  });
  const [filterDraft, setFilterDraft] = useState<TransactionFilterDraft>(
    createEmptyTransactionFilterDraft
  );
  const [filterErrors, setFilterErrors] = useState<TransactionFilterErrors>({});
  const [activeFilters, setActiveFilters] = useState<TransactionFilters>({});
  const [activeSort, setActiveSort] = useState<TransactionSort>({
    field: "date",
    direction: "desc"
  });
  const dashboardSelector = useMemo(createTransactionDashboardSelector, []);

  const loadTransactions = useCallback(() => {
    setState({ status: "loading" });
    void getTransactionsUseCase
      .execute()
      .then((transactions) => {
        setState({ status: "success", transactions });
      })
      .catch((error: unknown) => {
        setState({ status: "error", error });
      });
  }, [getTransactionsUseCase]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const visibleTransactions = useMemo(() => {
    if (state.status !== "success") {
      return [];
    }

    return searchTransactions(state.transactions, {
      filters: activeFilters,
      sort: activeSort
    });
  }, [activeFilters, activeSort, state]);

  const filtersAreActive =
    Object.keys(activeFilters).length > 0 ||
    activeSort.field !== "date" ||
    activeSort.direction !== "desc";
  const dashboardData = useMemo(
    () => dashboardSelector(visibleTransactions),
    [dashboardSelector, visibleTransactions]
  );

  const applyFilters = () => {
    const parsed = parseTransactionFilterDraft(filterDraft);

    if (!parsed.success) {
      setFilterErrors(parsed.errors);
      return;
    }

    setFilterErrors({});
    setActiveFilters(parsed.filters);
    setActiveSort(parsed.sort);
  };

  const clearFilters = () => {
    setFilterDraft(createEmptyTransactionFilterDraft());
    setFilterErrors({});
    setActiveFilters({});
    setActiveSort({ field: "date", direction: "desc" });
  };

  return (
    <section className="grid gap-6">
      <PageTitle
        eyebrow="Movimientos"
        title="Listado de movimientos"
        description="Consulta los ingresos y egresos guardados en el archivo local."
        actions={
          state.status === "success" ? (
            <div className="flex flex-wrap gap-2">
              <BackupRestoreControls
                downloadFile={downloadFile}
                exportStorageDocumentUseCase={exportStorageDocumentUseCase}
                importStorageDocumentUseCase={importStorageDocumentUseCase}
                mapError={mapError}
                previewImportStorageDocumentUseCase={
                  previewImportStorageDocumentUseCase
                }
                onImported={async () => {
                  await getTransactionsUseCase.execute().then((transactions) => {
                    setState({ status: "success", transactions });
                  });
                }}
              />
              <Button
                type="button"
                onClick={() => {
                  setFormState({ status: "create" });
                }}
              >
                <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                Nuevo movimiento
              </Button>
              {state.transactions.length > 0 ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setDeleteState({ status: "confirmingAll" });
                  }}
                >
                  <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                  Eliminar todos
                </Button>
              ) : null}
            </div>
          ) : null
        }
      />

      {state.status === "loading" ? (
        <LoadingState
          title="Cargando movimientos"
          message="Leyendo el archivo local de la aplicacion."
        />
      ) : null}

      {state.status === "error" ? (
        <RecoveryPanel
          downloadFile={downloadFile}
          error={state.error}
          exportStorageDocumentUseCase={exportStorageDocumentUseCase}
          importStorageDocumentUseCase={importStorageDocumentUseCase}
          mapError={mapError}
          previewImportStorageDocumentUseCase={
            previewImportStorageDocumentUseCase
          }
          onImported={async () => {
            await getTransactionsUseCase.execute().then((transactions) => {
              setState({ status: "success", transactions });
            });
          }}
          onRetry={loadTransactions}
        />
      ) : null}

      {state.status === "success" ? (
        <>
          <TransactionsFilterPanel
            draft={filterDraft}
            errors={filterErrors}
            onApply={applyFilters}
            onChange={setFilterDraft}
            onClear={clearFilters}
          />

          <FinancialDashboard
            expenseDistribution={dashboardData.expenseDistribution}
            summary={dashboardData.summary}
          />

          {state.transactions.length === 0 ? (
            <EmptyState
              title="Sin movimientos registrados"
              message="Todavia no hay ingresos ni egresos guardados."
              actionLabel="Nuevo movimiento"
              onAction={() => {
                setFormState({ status: "create" });
              }}
            />
          ) : null}

          {state.transactions.length > 0 && visibleTransactions.length === 0 ? (
            <EmptyState
              title="Sin resultados para los filtros"
              message="No hay movimientos que coincidan con los criterios activos."
              actionLabel={filtersAreActive ? "Limpiar filtros" : undefined}
              onAction={filtersAreActive ? clearFilters : undefined}
            />
          ) : null}

          {visibleTransactions.length > 0 ? (
            <TransactionsList
              transactions={visibleTransactions}
              onEdit={(transaction) => {
                setFormState({ status: "edit", transaction });
              }}
              onDelete={(transaction) => {
                setDeleteState({ status: "confirming", transaction });
              }}
            />
          ) : null}
        </>
      ) : null}

      <TransactionFormDialog
        mode={formState.status === "edit" ? "edit" : "create"}
        open={formState.status !== "closed"}
        transaction={
          formState.status === "edit" ? formState.transaction : undefined
        }
        onOpenChange={(open) => {
          if (!open) {
            setFormState({ status: "closed" });
          }
        }}
        onCreate={(input) => createTransactionUseCase.execute(input)}
        onUpdate={(input) => updateTransactionUseCase.execute(input)}
        onSuccess={async () => {
          await getTransactionsUseCase.execute().then((transactions) => {
            setState({ status: "success", transactions });
          });
        }}
        mapError={mapError}
      />

      <DeleteTransactionDialog
        open={deleteState.status === "confirming"}
        transaction={
          deleteState.status === "confirming"
            ? deleteState.transaction
            : null
        }
        onOpenChange={(open) => {
          if (!open) {
            setDeleteState({ status: "closed" });
          }
        }}
        onDelete={(id) => deleteTransactionUseCase.execute(id)}
        onSuccess={async () => {
          await getTransactionsUseCase.execute().then((transactions) => {
            setState({ status: "success", transactions });
          });
        }}
        mapError={mapError}
      />

      <DeleteAllTransactionsDialog
        open={deleteState.status === "confirmingAll"}
        transactionCount={
          state.status === "success" ? state.transactions.length : 0
        }
        onOpenChange={(open) => {
          if (!open) {
            setDeleteState({ status: "closed" });
          }
        }}
        onVerifyPassword={(password) => verifyPasswordUseCase.execute(password)}
        onDeleteAll={() => deleteAllTransactionsUseCase.execute()}
        onSuccess={async () => {
          await getTransactionsUseCase.execute().then((transactions) => {
            setState({ status: "success", transactions });
          });
        }}
        mapError={mapError}
      />
    </section>
  );
}

function RecoveryPanel({
  error,
  exportStorageDocumentUseCase,
  previewImportStorageDocumentUseCase,
  importStorageDocumentUseCase,
  downloadFile,
  mapError,
  onImported,
  onRetry
}: Pick<
  TransactionsPageProps,
  | "exportStorageDocumentUseCase"
  | "previewImportStorageDocumentUseCase"
  | "importStorageDocumentUseCase"
  | "downloadFile"
  | "mapError"
> & {
  error: unknown;
  onImported(this: void): Promise<void>;
  onRetry(this: void): void;
}) {
  const message = mapError(error);

  return (
    <div className="grid gap-4">
      <ErrorState
        title={message.title}
        message={message.message}
        actionLabel="Reintentar"
        onAction={onRetry}
      />
      {message.recoveryAction ? (
        <p className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          {message.recoveryAction}
        </p>
      ) : null}
      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold">Recuperar desde respaldo</h2>
        </div>
        <BackupRestoreControls
          downloadFile={downloadFile}
          exportStorageDocumentUseCase={exportStorageDocumentUseCase}
          importStorageDocumentUseCase={importStorageDocumentUseCase}
          mapError={mapError}
          mode="recovery"
          previewImportStorageDocumentUseCase={
            previewImportStorageDocumentUseCase
          }
          onImported={onImported}
        />
      </section>
    </div>
  );
}

type FormState =
  | { status: "closed" }
  | { status: "create" }
  | { status: "edit"; transaction: FinancialTransaction };

type DeleteState =
  | { status: "closed" }
  | { status: "confirming"; transaction: FinancialTransaction }
  | { status: "confirmingAll" };

function TransactionsList({
  transactions,
  onEdit,
  onDelete
}: {
  transactions: FinancialTransaction[];
  onEdit(this: void, transaction: FinancialTransaction): void;
  onDelete(this: void, transaction: FinancialTransaction): void;
}) {
  const columns = useMemo<ColumnDef<FinancialTransaction>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Fecha",
        cell: ({ row }) => formatTransactionDate(row.original.date)
      },
      {
        accessorKey: "type",
        header: "Tipo",
        cell: ({ row }) => <TransactionTypeBadge type={row.original.type} />
      },
      {
        accessorKey: "description",
        header: "Descripcion"
      },
      {
        accessorKey: "category",
        header: "Categoria",
        cell: ({ row }) => getCategoryLabel(row.original.category)
      },
      {
        accessorKey: "paymentMethod",
        header: "Medio de pago",
        cell: ({ row }) => getPaymentMethodLabel(row.original.paymentMethod)
      },
      {
        accessorKey: "amount",
        header: "Importe",
        cell: ({ row }) => formatTransactionAmount(row.original.amount)
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
          <TransactionActions
            onDelete={onDelete}
            onEdit={onEdit}
            transaction={row.original}
          />
        )
      }
    ],
    [onDelete, onEdit]
  );
  const table = useReactTable({
    data: transactions,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm md:block">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="bg-muted/70 text-left text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-4 py-3 font-medium">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {transactions.map((transaction) => (
          <article
            key={transaction.id}
            className="rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {transaction.description}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatTransactionDate(transaction.date)}
                </p>
              </div>
              <TransactionTypeBadge type={transaction.type} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Categoria</dt>
                <dd className="font-medium">
                  {getCategoryLabel(transaction.category)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Medio</dt>
                <dd className="font-medium">
                  {getPaymentMethodLabel(transaction.paymentMethod)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Importe</dt>
                <dd className="text-lg font-semibold">
                  {formatTransactionAmount(transaction.amount)}
                </dd>
              </div>
            </dl>
            <div className="mt-4">
              <TransactionActions
                onDelete={onDelete}
                onEdit={onEdit}
                transaction={transaction}
              />
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function TransactionActions({
  transaction,
  onEdit,
  onDelete
}: {
  transaction: FinancialTransaction;
  onEdit(this: void, transaction: FinancialTransaction): void;
  onDelete(this: void, transaction: FinancialTransaction): void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        aria-label={`Editar movimiento ${transaction.description}`}
        size="icon"
        type="button"
        variant="outline"
        onClick={() => {
          onEdit(transaction);
        }}
      >
        <Edit aria-hidden="true" className="h-4 w-4" />
      </Button>
      <Button
        aria-label={`Eliminar movimiento ${transaction.description}`}
        size="icon"
        type="button"
        variant="outline"
        onClick={() => {
          onDelete(transaction);
        }}
      >
        <Trash2 aria-hidden="true" className="h-4 w-4" />
      </Button>
    </div>
  );
}
