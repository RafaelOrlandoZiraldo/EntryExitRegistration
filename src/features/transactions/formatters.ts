import {
  expenseCategoryOptions,
  incomeCategoryOptions,
  paymentMethodOptions,
  type TransactionCategoryKey,
  type PaymentMethod
} from "@domain/transactions";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC"
});

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS"
});

const categoryLabels = new Map<TransactionCategoryKey, string>([
  ...incomeCategoryOptions.map((option) => [option.key, option.label] as const),
  ...expenseCategoryOptions.map((option) => [option.key, option.label] as const)
]);

const paymentMethodLabels = new Map<PaymentMethod, string>(
  paymentMethodOptions.map((option) => [option.key, option.label] as const)
);

export function formatTransactionDate(value: string) {
  return dateFormatter.format(new Date(`${value}T00:00:00.000Z`));
}

export function formatTransactionAmount(value: number) {
  return currencyFormatter.format(value);
}

export function getCategoryLabel(category: TransactionCategoryKey) {
  return categoryLabels.get(category) ?? category;
}

export function getPaymentMethodLabel(paymentMethod: PaymentMethod) {
  return paymentMethodLabels.get(paymentMethod) ?? paymentMethod;
}
