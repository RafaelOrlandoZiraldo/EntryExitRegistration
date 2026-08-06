import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, Edit, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CreateTransactionInput,
  ExportStorageDocumentResult,
  ImportPreview,
  UpdateTransactionInput
} from "@application/use-cases";
import type {
  GetTransactionsPageInput,
  GetTransactionsPageResult
} from "@application/ports";
import type { FinancialTransaction } from "@domain/transactions";
import {
  calculateFinancialSummary,
  groupExpensesByCategory,
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
import { FinancialDashboard } from "./FinancialDashboard";
import { TransactionsFilterPanel } from "./TransactionsFilterPanel";
import { TransactionFormDialog } from "./TransactionFormDialog";

export interface TransactionsPageProps {
  getTransactionsUseCase: {
    execute(
      this: void,
      input: GetTransactionsPageInput
    ): Promise<GetTransactionsPageResult>;
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
  | { status: "success" } & GetTransactionsPageResult
  | { status: "error"; error: unknown };

const defaultPagination: PaginationState = {
  pageIndex: 0,
  pageSize: 10
};

function createEmptyDashboard() {
  const transactions: FinancialTransaction[] = [];

  return {
    summary: calculateFinancialSummary(transactions),
    expenseDistribution: groupExpensesByCategory(transactions)
  };
}

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
  const [pagination, setPagination] =
    useState<PaginationState>(defaultPagination);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [tableIsLoading, setTableIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    updateViewport();
    mediaQuery.addEventListener?.("change", updateViewport);

    return () => {
      mediaQuery.removeEventListener?.("change", updateViewport);
    };
  }, []);

  const loadTransactions = useCallback(
    ({
      nextPagination,
      mode,
      scope
    }: {
      nextPagination: PaginationState;
      mode: "replace" | "append";
      scope: "page" | "table";
    }) => {
      if (scope === "page") {
        setState({ status: "loading" });
      } else {
        setTableIsLoading(true);
      }

      void getTransactionsUseCase
        .execute({
          ...nextPagination,
          filters: activeFilters,
          sort: activeSort
        })
        .then((result) => {
          setState((current) => ({
            status: "success",
            transactions:
              mode === "append" && current.status === "success"
                ? [...current.transactions, ...result.transactions]
                : result.transactions,
            total: result.total,
            dashboard: result.dashboard
          }));
        })
        .catch((error: unknown) => {
          setState({ status: "error", error });
        })
        .finally(() => {
          if (scope === "table") {
            setTableIsLoading(false);
          }
        });
    },
    [activeFilters, activeSort, getTransactionsUseCase]
  );

  useEffect(() => {
    const nextPagination = defaultPagination;

    setPagination(nextPagination);
    loadTransactions({ nextPagination, mode: "replace", scope: "page" });
  }, [loadTransactions]);

  const filtersAreActive =
    Object.keys(activeFilters).length > 0 ||
    activeSort.field !== "date" ||
    activeSort.direction !== "desc";
  const dashboardData =
    state.status === "success"
      ? state.dashboard
      : createEmptyDashboard();

  const applyFilters = () => {
    const parsed = parseTransactionFilterDraft(filterDraft);

    if (!parsed.success) {
      setFilterErrors(parsed.errors);
      return;
    }

    setFilterErrors({});
    setActiveFilters(parsed.filters);
    setActiveSort(parsed.sort);
    setPagination(defaultPagination);
  };

  const clearFilters = () => {
    setFilterDraft(createEmptyTransactionFilterDraft());
    setFilterErrors({});
    setActiveFilters({});
    setActiveSort({ field: "date", direction: "desc" });
    setPagination(defaultPagination);
  };

  const refreshCurrentPage = async () => {
    await getTransactionsUseCase
      .execute({
        ...pagination,
        filters: activeFilters,
        sort: activeSort
      })
      .then((result) => {
        setState({ status: "success", ...result });
      });
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
                  await refreshCurrentPage();
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
            await refreshCurrentPage();
          }}
          onRetry={() => {
            loadTransactions({
              nextPagination: pagination,
              mode: "replace",
              scope: "page"
            });
          }}
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

          {state.transactions.length === 0 &&
          state.total === 0 &&
          !filtersAreActive ? (
            <EmptyState
              title="Sin movimientos registrados"
              message="Todavia no hay ingresos ni egresos guardados."
              actionLabel="Nuevo movimiento"
              onAction={() => {
                setFormState({ status: "create" });
              }}
            />
          ) : null}

          {state.transactions.length === 0 &&
          state.total === 0 &&
          filtersAreActive ? (
            <EmptyState
              title="Sin resultados para los filtros"
              message="No hay movimientos que coincidan con los criterios activos."
              actionLabel={filtersAreActive ? "Limpiar filtros" : undefined}
              onAction={filtersAreActive ? clearFilters : undefined}
            />
          ) : null}

          {state.transactions.length > 0 ? (
            <TransactionsList
              isMobileViewport={isMobileViewport}
              pagination={pagination}
              tableIsLoading={tableIsLoading}
              totalRows={state.total}
              transactions={state.transactions}
              onLoadMore={() => {
                const nextPagination = {
                  pageIndex: pagination.pageIndex + 1,
                  pageSize: pagination.pageSize
                };

                setPagination(nextPagination);
                loadTransactions({
                  nextPagination,
                  mode: "append",
                  scope: "table"
                });
              }}
              onPaginationChange={(nextPagination) => {
                setPagination(nextPagination);
                loadTransactions({
                  nextPagination,
                  mode: "replace",
                  scope: "table"
                });
              }}
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
          await refreshCurrentPage();
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
          await refreshCurrentPage();
        }}
        mapError={mapError}
      />

      <DeleteAllTransactionsDialog
        open={deleteState.status === "confirmingAll"}
        transactionCount={
          state.status === "success" ? state.total : 0
        }
        onOpenChange={(open) => {
          if (!open) {
            setDeleteState({ status: "closed" });
          }
        }}
        onVerifyPassword={(password) => verifyPasswordUseCase.execute(password)}
        onDeleteAll={() => deleteAllTransactionsUseCase.execute()}
        onSuccess={async () => {
          await refreshCurrentPage();
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
  isMobileViewport,
  pagination,
  tableIsLoading,
  totalRows,
  transactions,
  onLoadMore,
  onPaginationChange,
  onEdit,
  onDelete
}: {
  isMobileViewport: boolean;
  pagination: PaginationState;
  tableIsLoading: boolean;
  totalRows: number;
  transactions: FinancialTransaction[];
  onLoadMore(this: void): void;
  onPaginationChange(this: void, pagination: PaginationState): void;
  onEdit(this: void, transaction: FinancialTransaction): void;
  onDelete(this: void, transaction: FinancialTransaction): void;
}) {
  const mobileLoadMoreRef = useRef<HTMLDivElement | null>(null);
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
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(totalRows / pagination.pageSize),
    state: {
      pagination
    }
  });
  const hasMoreMobileTransactions = transactions.length < totalRows;

  useEffect(() => {
    if (!isMobileViewport || !hasMoreMobileTransactions) {
      return;
    }

    const loadMoreTrigger = mobileLoadMoreRef.current;

    if (!loadMoreTrigger || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }

      onLoadMore();
    });

    observer.observe(loadMoreTrigger);

    return () => {
      observer.disconnect();
    };
  }, [hasMoreMobileTransactions, isMobileViewport, onLoadMore]);

  return (
    <>
      <div
        aria-busy={tableIsLoading}
        className="relative hidden overflow-x-auto rounded-lg border border-border bg-card shadow-sm md:block"
      >
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
        {tableIsLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-card/70 text-sm font-medium text-muted-foreground">
            Cargando pagina
          </div>
        ) : null}
      </div>

      <div aria-busy={tableIsLoading} className="grid gap-3 md:hidden">
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

        {hasMoreMobileTransactions ? (
          <div
            ref={mobileLoadMoreRef}
            aria-hidden="true"
            className="h-8"
          />
        ) : null}
      </div>

      <TransactionsPagination
        pagination={pagination}
        tableIsLoading={tableIsLoading}
        totalRows={totalRows}
        onPaginationChange={onPaginationChange}
      />
    </>
  );
}

function TransactionsPagination({
  pagination,
  tableIsLoading,
  totalRows,
  onPaginationChange
}: {
  pagination: PaginationState;
  tableIsLoading: boolean;
  totalRows: number;
  onPaginationChange(this: void, pagination: PaginationState): void;
}) {
  const pageCount = Math.ceil(totalRows / pagination.pageSize);
  const pageIndex = pagination.pageIndex;
  const pageSize = pagination.pageSize;
  const currentPageStart = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const currentPageEnd = Math.min((pageIndex + 1) * pageSize, totalRows);

  if (totalRows <= 10) {
    return null;
  }

  return (
    <nav
      aria-label="Paginacion de movimientos"
      className="hidden flex-col gap-3 rounded-lg border border-border bg-card p-3 text-sm shadow-sm md:flex md:flex-row md:items-center md:justify-between"
    >
      <p className="text-muted-foreground">
        Mostrando {currentPageStart}-{currentPageEnd} de {totalRows}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label
          className="flex items-center gap-2 text-muted-foreground"
          htmlFor="transactions-page-size"
        >
          Filas por pagina
          <select
            id="transactions-page-size"
            className="h-9 rounded-md border border-input bg-background px-2 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={tableIsLoading}
            value={pageSize}
            onChange={(event) => {
              onPaginationChange({
                pageIndex: 0,
                pageSize: Number(event.target.value)
              });
            }}
          >
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <p aria-live="polite" className="min-w-24 text-center font-medium">
          Pagina {pageIndex + 1} de {pageCount}
        </p>

        <Button
          aria-label="Pagina anterior"
          disabled={tableIsLoading || pageIndex === 0}
          size="icon"
          type="button"
          variant="outline"
          onClick={() => {
            onPaginationChange({
              pageIndex: Math.max(pageIndex - 1, 0),
              pageSize
            });
          }}
        >
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </Button>
        <Button
          aria-label="Pagina siguiente"
          disabled={tableIsLoading || pageIndex + 1 >= pageCount}
          size="icon"
          type="button"
          variant="outline"
          onClick={() => {
            onPaginationChange({
              pageIndex: pageIndex + 1,
              pageSize
            });
          }}
        >
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </nav>
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
