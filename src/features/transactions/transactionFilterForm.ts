import type {
  TransactionFilters,
  TransactionSort
} from "@domain/transactions";
import { transactionFiltersSchema, transactionSortSchema } from "@domain/transactions";

export interface TransactionFilterDraft {
  dateFrom: string;
  dateTo: string;
  type: "" | "income" | "expense";
  category: string;
  paymentMethod: string;
  text: string;
  amountMin: string;
  amountMax: string;
  sortField: TransactionSort["field"];
  sortDirection: TransactionSort["direction"];
}

export type TransactionFilterErrors = Partial<
  Record<keyof TransactionFilterDraft, string>
>;

export type ParseTransactionFilterDraftResult =
  | {
      success: true;
      filters: TransactionFilters;
      sort: TransactionSort;
    }
  | {
      success: false;
      errors: TransactionFilterErrors;
    };

export function createEmptyTransactionFilterDraft(): TransactionFilterDraft {
  return {
    dateFrom: "",
    dateTo: "",
    type: "",
    category: "",
    paymentMethod: "",
    text: "",
    amountMin: "",
    amountMax: "",
    sortField: "date",
    sortDirection: "desc"
  };
}

export function parseTransactionFilterDraft(
  draft: TransactionFilterDraft
): ParseTransactionFilterDraftResult {
  const filters: TransactionFilters = {
    ...(draft.dateFrom ? { dateFrom: draft.dateFrom } : {}),
    ...(draft.dateTo ? { dateTo: draft.dateTo } : {}),
    ...(draft.type ? { type: draft.type } : {}),
    ...(draft.category ? { category: draft.category as TransactionFilters["category"] } : {}),
    ...(draft.paymentMethod
      ? { paymentMethod: draft.paymentMethod as TransactionFilters["paymentMethod"] }
      : {}),
    ...(draft.text.trim() ? { text: draft.text.trim() } : {}),
    ...(draft.amountMin ? { amountMin: Number(draft.amountMin) } : {}),
    ...(draft.amountMax ? { amountMax: Number(draft.amountMax) } : {})
  };
  const sort = {
    field: draft.sortField,
    direction: draft.sortDirection
  };
  const filterResult = transactionFiltersSchema.safeParse(filters);
  const sortResult = transactionSortSchema.safeParse(sort);

  if (filterResult.success && sortResult.success) {
    return {
      success: true,
      filters: filterResult.data,
      sort: sortResult.data
    };
  }

  return {
    success: false,
    errors: {
      ...mapFilterErrors(filterResult),
      ...mapSortErrors(sortResult)
    }
  };
}

function mapFilterErrors(
  result: ReturnType<typeof transactionFiltersSchema.safeParse>
): TransactionFilterErrors {
  if (result.success) {
    return {};
  }

  const errors: TransactionFilterErrors = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0];

    if (field === "dateFrom" || field === "dateTo") {
      errors[field] = "Revisar el rango de fechas.";
    }

    if (field === "amountMin" || field === "amountMax") {
      errors[field] = "Revisar el rango de importes.";
    }

    if (field === "category") {
      errors.category = "La categoria no corresponde al tipo seleccionado.";
    }
  }

  return errors;
}

function mapSortErrors(
  result: ReturnType<typeof transactionSortSchema.safeParse>
): TransactionFilterErrors {
  if (result.success) {
    return {};
  }

  return {
    sortField: "Revisar el ordenamiento.",
    sortDirection: "Revisar el ordenamiento."
  };
}
