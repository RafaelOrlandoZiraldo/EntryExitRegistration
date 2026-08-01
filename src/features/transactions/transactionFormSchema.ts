import { z } from "zod";
import {
  expenseCategoryKeys,
  incomeCategoryKeys,
  paymentMethods,
  transactionTypes
} from "@domain/transactions";

export const transactionFormSchema = z
  .object({
    type: z.enum(transactionTypes),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Ingresar una fecha valida."),
    amount: z.coerce
      .number({ invalid_type_error: "Ingresar un importe valido." })
      .positive("El importe debe ser mayor que cero."),
    category: z.enum([...incomeCategoryKeys, ...expenseCategoryKeys], {
      required_error: "Seleccionar una categoria."
    }),
    description: z.string().trim().min(1, "Ingresar una descripcion."),
    paymentMethod: z.enum(paymentMethods, {
      required_error: "Seleccionar un medio de pago."
    }),
    notes: z.string().trim().optional()
  })
  .refine(
    (values) =>
      values.type === "income"
        ? incomeCategoryKeys.includes(
            values.category as (typeof incomeCategoryKeys)[number]
          )
        : expenseCategoryKeys.includes(
            values.category as (typeof expenseCategoryKeys)[number]
          ),
    {
      message: "La categoria no corresponde al tipo seleccionado.",
      path: ["category"]
    }
  );

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;
