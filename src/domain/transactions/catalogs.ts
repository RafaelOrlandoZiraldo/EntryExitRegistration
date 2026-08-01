import {
  expenseCategoryKeys,
  incomeCategoryKeys,
  paymentMethods,
  type ExpenseCategoryKey,
  type IncomeCategoryKey,
  type PaymentMethod,
  type TransactionCategoryKey,
  type TransactionType
} from "./types";

export interface CatalogOption<TKey extends string> {
  key: TKey;
  label: string;
}

export const paymentMethodOptions = [
  { key: "cash", label: "Efectivo" },
  { key: "debit_card", label: "Debito" },
  { key: "credit_card", label: "Credito" },
  { key: "bank_transfer", label: "Transferencia" },
  { key: "digital_wallet", label: "Billetera virtual" },
  { key: "other", label: "Otro" }
] as const satisfies readonly CatalogOption<PaymentMethod>[];

export const incomeCategoryOptions = [
  { key: "salary", label: "Sueldo" },
  { key: "additional_income", label: "Ingresos adicionales" },
  { key: "sale", label: "Venta" },
  { key: "refund", label: "Reintegro" },
  { key: "interest", label: "Intereses" },
  { key: "gift", label: "Regalo" },
  { key: "other_income", label: "Otro ingreso" }
] as const satisfies readonly CatalogOption<IncomeCategoryKey>[];

export const expenseCategoryOptions = [
  { key: "rent", label: "Alquiler" },
  { key: "utilities", label: "Servicios" },
  { key: "groceries", label: "Supermercado" },
  { key: "transport", label: "Transporte" },
  { key: "health", label: "Salud" },
  { key: "education", label: "Educacion" },
  { key: "entertainment", label: "Entretenimiento" },
  { key: "clothing", label: "Indumentaria" },
  { key: "taxes", label: "Impuestos" },
  { key: "debts", label: "Deudas" },
  { key: "maintenance", label: "Mantenimiento" },
  { key: "pets", label: "Mascotas" },
  { key: "other_expense", label: "Otro egreso" }
] as const satisfies readonly CatalogOption<ExpenseCategoryKey>[];

const incomeCategorySet = new Set<string>(incomeCategoryKeys);
const expenseCategorySet = new Set<string>(expenseCategoryKeys);
const paymentMethodSet = new Set<string>(paymentMethods);

export function isPaymentMethod(value: string): value is PaymentMethod {
  return paymentMethodSet.has(value);
}

export function isTransactionCategoryKey(
  value: string
): value is TransactionCategoryKey {
  return incomeCategorySet.has(value) || expenseCategorySet.has(value);
}

export function isCategoryCompatibleWithType(
  type: TransactionType,
  category: string
): category is TransactionCategoryKey {
  return type === "income"
    ? incomeCategorySet.has(category)
    : expenseCategorySet.has(category);
}

export function getCategoryOptionsByType(type: TransactionType) {
  return type === "income" ? incomeCategoryOptions : expenseCategoryOptions;
}
