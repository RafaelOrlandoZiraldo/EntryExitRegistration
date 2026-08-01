import { z } from "zod";
import {
  expenseCategoryKeys,
  incomeCategoryKeys,
  paymentMethods,
  transactionTypes
} from "./types";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
    message: "Date must be valid."
  });

const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: "Date-time must be a valid ISO string." });

const categorySchema = z.enum([...incomeCategoryKeys, ...expenseCategoryKeys]);

export const financialTransactionSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(transactionTypes),
    date: isoDateSchema,
    amount: z.number().positive().finite(),
    category: categorySchema,
    description: z.string().trim().min(1),
    paymentMethod: z.enum(paymentMethods),
    notes: z.string().trim().optional(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema
  })
  .refine(
    (transaction) =>
      transaction.type === "income"
        ? incomeCategoryKeys.includes(
            transaction.category as (typeof incomeCategoryKeys)[number]
          )
        : expenseCategoryKeys.includes(
            transaction.category as (typeof expenseCategoryKeys)[number]
          ),
    {
      message: "Category must be compatible with transaction type.",
      path: ["category"]
    }
  );

export const transactionFiltersSchema = z
  .object({
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    type: z.enum(transactionTypes).optional(),
    category: categorySchema.optional(),
    paymentMethod: z.enum(paymentMethods).optional(),
    text: z.string().trim().optional(),
    amountMin: z.number().positive().finite().optional(),
    amountMax: z.number().positive().finite().optional()
  })
  .refine(
    (filters) =>
      filters.dateFrom === undefined ||
      filters.dateTo === undefined ||
      filters.dateFrom <= filters.dateTo,
    {
      message: "Date from cannot be after date to.",
      path: ["dateFrom"]
    }
  )
  .refine(
    (filters) =>
      filters.amountMin === undefined ||
      filters.amountMax === undefined ||
      filters.amountMin <= filters.amountMax,
    {
      message: "Minimum amount cannot be greater than maximum amount.",
      path: ["amountMin"]
    }
  )
  .refine(
    (filters) =>
      filters.type === undefined ||
      filters.category === undefined ||
      (filters.type === "income"
        ? incomeCategoryKeys.includes(
            filters.category as (typeof incomeCategoryKeys)[number]
          )
        : expenseCategoryKeys.includes(
            filters.category as (typeof expenseCategoryKeys)[number]
          )),
    {
      message: "Category filter must be compatible with transaction type.",
      path: ["category"]
    }
  );

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

export const transactionSortFields = ["date", "amount", "category"] as const;
export const sortDirections = ["asc", "desc"] as const;

export const transactionSortSchema = z.object({
  field: z.enum(transactionSortFields),
  direction: z.enum(sortDirections)
});

export type TransactionSort = z.infer<typeof transactionSortSchema>;
