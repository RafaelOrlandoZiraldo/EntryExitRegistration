import { SlidersHorizontal, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  expenseCategoryOptions,
  getCategoryOptionsByType,
  incomeCategoryOptions,
  paymentMethodOptions
} from "@domain/transactions";
import { Button } from "@shared/ui";
import type {
  TransactionFilterDraft,
  TransactionFilterErrors
} from "./transactionFilterForm";

export interface TransactionsFilterPanelProps {
  draft: TransactionFilterDraft;
  errors: TransactionFilterErrors;
  onChange(this: void, draft: TransactionFilterDraft): void;
  onApply(this: void): void;
  onClear(this: void): void;
}

export function TransactionsFilterPanel({
  draft,
  errors,
  onChange,
  onApply,
  onClear
}: TransactionsFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const categoryOptions = useMemo(() => {
    if (draft.type === "income" || draft.type === "expense") {
      return getCategoryOptionsByType(draft.type);
    }

    return [...incomeCategoryOptions, ...expenseCategoryOptions];
  }, [draft.type]);

  const updateDraft = (patch: Partial<TransactionFilterDraft>) => {
    const nextDraft = { ...draft, ...patch };

    if (
      patch.type !== undefined &&
      nextDraft.category &&
      !categoryOptions.some((option) => option.key === nextDraft.category)
    ) {
      nextDraft.category = "";
    }

    onChange(nextDraft);
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Filtros y ordenamiento</h2>
        </div>
        <Button
          aria-expanded={isExpanded}
          aria-controls="transaction-filter-panel"
          className="md:hidden"
          size="icon"
          type="button"
          variant="outline"
          onClick={() => {
            setIsExpanded((current) => !current);
          }}
        >
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Mostrar filtros</span>
        </Button>
      </div>

      <div
        className={isExpanded ? "mt-4 grid gap-4" : "mt-4 hidden gap-4 md:grid"}
        id="transaction-filter-panel"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FilterField error={errors.dateFrom} id="filter-date-from" label="Fecha desde">
            <input
              className={fieldClassName}
              id="filter-date-from"
              type="date"
              value={draft.dateFrom}
              onChange={(event) => {
                updateDraft({ dateFrom: event.target.value });
              }}
            />
          </FilterField>
          <FilterField error={errors.dateTo} id="filter-date-to" label="Fecha hasta">
            <input
              className={fieldClassName}
              id="filter-date-to"
              type="date"
              value={draft.dateTo}
              onChange={(event) => {
                updateDraft({ dateTo: event.target.value });
              }}
            />
          </FilterField>
          <FilterField id="filter-type" label="Tipo">
            <select
              className={fieldClassName}
              id="filter-type"
              value={draft.type}
              onChange={(event) => {
                updateDraft({
                  type: event.target.value as TransactionFilterDraft["type"],
                  category: ""
                });
              }}
            >
              <option value="">Todos</option>
              <option value="income">Ingreso</option>
              <option value="expense">Egreso</option>
            </select>
          </FilterField>
          <FilterField error={errors.category} id="filter-category" label="Categoria">
            <select
              className={fieldClassName}
              id="filter-category"
              value={draft.category}
              onChange={(event) => {
                updateDraft({ category: event.target.value });
              }}
            >
              <option value="">Todas</option>
              {categoryOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField id="filter-payment-method" label="Medio de pago">
            <select
              className={fieldClassName}
              id="filter-payment-method"
              value={draft.paymentMethod}
              onChange={(event) => {
                updateDraft({ paymentMethod: event.target.value });
              }}
            >
              <option value="">Todos</option>
              {paymentMethodOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </FilterField>
          <FilterField id="filter-text" label="Texto">
            <input
              className={fieldClassName}
              id="filter-text"
              placeholder="Descripcion u observaciones"
              value={draft.text}
              onChange={(event) => {
                updateDraft({ text: event.target.value });
              }}
            />
          </FilterField>
          <FilterField error={errors.amountMin} id="filter-amount-min" label="Importe minimo">
            <input
              className={fieldClassName}
              id="filter-amount-min"
              inputMode="decimal"
              type="number"
              value={draft.amountMin}
              onChange={(event) => {
                updateDraft({ amountMin: event.target.value });
              }}
            />
          </FilterField>
          <FilterField error={errors.amountMax} id="filter-amount-max" label="Importe maximo">
            <input
              className={fieldClassName}
              id="filter-amount-max"
              inputMode="decimal"
              type="number"
              value={draft.amountMax}
              onChange={(event) => {
                updateDraft({ amountMax: event.target.value });
              }}
            />
          </FilterField>
          <FilterField error={errors.sortField} id="filter-sort-field" label="Ordenar por">
            <select
              className={fieldClassName}
              id="filter-sort-field"
              value={draft.sortField}
              onChange={(event) => {
                updateDraft({
                  sortField: event.target.value as TransactionFilterDraft["sortField"]
                });
              }}
            >
              <option value="date">Fecha</option>
              <option value="amount">Importe</option>
              <option value="category">Categoria</option>
            </select>
          </FilterField>
          <FilterField error={errors.sortDirection} id="filter-sort-direction" label="Direccion">
            <select
              className={fieldClassName}
              id="filter-sort-direction"
              value={draft.sortDirection}
              onChange={(event) => {
                updateDraft({
                  sortDirection:
                    event.target.value as TransactionFilterDraft["sortDirection"]
                });
              }}
            >
              <option value="desc">Descendente</option>
              <option value="asc">Ascendente</option>
            </select>
          </FilterField>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClear}>
            <X aria-hidden="true" className="mr-2 h-4 w-4" />
            Limpiar filtros
          </Button>
          <Button type="button" onClick={onApply}>
            Aplicar filtros
          </Button>
        </div>
      </div>
    </section>
  );
}

function FilterField({
  id,
  label,
  error,
  children
}: {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-destructive" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

const fieldClassName =
  "h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring";
