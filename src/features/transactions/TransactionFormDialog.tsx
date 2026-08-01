import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type {
  CreateTransactionInput,
  UpdateTransactionInput
} from "@application/use-cases";
import type { FinancialTransaction } from "@domain/transactions";
import {
  getCategoryOptionsByType,
  paymentMethodOptions,
  type TransactionCategoryKey
} from "@domain/transactions";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorAlert
} from "@shared/ui";
import {
  transactionFormSchema,
  type TransactionFormValues
} from "./transactionFormSchema";

export interface TransactionFormDialogProps {
  mode: "create" | "edit";
  open: boolean;
  transaction?: FinancialTransaction;
  onOpenChange(this: void, open: boolean): void;
  onCreate(this: void, input: CreateTransactionInput): Promise<unknown>;
  onUpdate(this: void, input: UpdateTransactionInput): Promise<unknown>;
  onSuccess(this: void): Promise<void>;
  mapError(this: void, error: unknown): { message: string };
}

export function TransactionFormDialog({
  mode,
  open,
  transaction,
  onOpenChange,
  onCreate,
  onUpdate,
  onSuccess,
  mapError
}: TransactionFormDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: getDefaultValues(transaction)
  });
  const selectedType = watch("type");
  const selectedCategory = watch("category");
  const categoryOptions = useMemo(
    () => getCategoryOptionsByType(selectedType),
    [selectedType]
  );

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(transaction));
      setSubmitError(null);
    }
  }, [open, reset, transaction]);

  useEffect(() => {
    const categoryIsCompatible = categoryOptions.some(
      (option) => option.key === selectedCategory
    );

    if (!categoryIsCompatible) {
      setValue("category", categoryOptions[0].key, {
        shouldDirty: true,
        shouldValidate: true
      });
    }
  }, [categoryOptions, selectedCategory, setValue]);

  const onSubmit = async (values: TransactionFormValues) => {
    setSubmitError(null);

    try {
      const input = normalizeFormValues(values);

      if (mode === "create") {
        await onCreate(input);
      } else {
        if (!transaction) {
          throw new Error("Transaction is required for edit mode.");
        }

        await onUpdate({
          id: transaction.id,
          ...input
        });
      }

      await onSuccess();
      onOpenChange(false);
    } catch (error) {
      const userFacingError = mapError(error);
      setSubmitError(userFacingError.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nuevo movimiento" : "Editar movimiento"}
          </DialogTitle>
          <DialogDescription>
            Completar los datos del movimiento domestico.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          noValidate
          onSubmit={(event) => {
            void handleSubmit(onSubmit)(event);
          }}
        >
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="transaction-type">
              Tipo
            </label>
            <select
              id="transaction-type"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
              {...register("type")}
            >
              <option value="income">Ingreso</option>
              <option value="expense">Egreso</option>
            </select>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Field
              error={errors.date?.message}
              id="transaction-date"
              label="Fecha"
            >
              <input
                id="transaction-date"
                type="date"
                className={fieldClassName}
                {...register("date")}
              />
            </Field>
            <Field
              error={errors.amount?.message}
              id="transaction-amount"
              label="Importe"
            >
              <input
                id="transaction-amount"
                inputMode="decimal"
                step="0.01"
                type="number"
                className={fieldClassName}
                {...register("amount")}
              />
            </Field>
          </div>

          <Field
            error={errors.category?.message}
            id="transaction-category"
            label="Categoria"
          >
            <select
              id="transaction-category"
              className={fieldClassName}
              {...register("category")}
            >
              {categoryOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            error={errors.description?.message}
            id="transaction-description"
            label="Descripcion"
          >
            <input
              id="transaction-description"
              className={fieldClassName}
              {...register("description")}
            />
          </Field>

          <Field
            error={errors.paymentMethod?.message}
            id="transaction-payment-method"
            label="Medio de pago"
          >
            <select
              id="transaction-payment-method"
              className={fieldClassName}
              {...register("paymentMethod")}
            >
              {paymentMethodOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field id="transaction-notes" label="Observaciones">
            <textarea
              id="transaction-notes"
              className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
              {...register("notes")}
            />
          </Field>

          {submitError ? <ErrorAlert message={submitError} /> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button disabled={isSubmitting} type="submit">
              <Save aria-hidden="true" className="mr-2 h-4 w-4" />
              {isSubmitting ? "Guardando" : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
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

function getDefaultValues(
  transaction?: FinancialTransaction
): TransactionFormValues {
  return {
    type: transaction?.type ?? "expense",
    date: transaction?.date ?? new Date().toISOString().slice(0, 10),
    amount: transaction?.amount ?? 0,
    category:
      transaction?.category ??
      ("groceries" satisfies TransactionCategoryKey),
    description: transaction?.description ?? "",
    paymentMethod: transaction?.paymentMethod ?? "debit_card",
    notes: transaction?.notes ?? ""
  };
}

function normalizeFormValues(
  values: TransactionFormValues
): CreateTransactionInput {
  const notes = values.notes?.trim();

  return {
    type: values.type,
    date: values.date,
    amount: values.amount,
    category: values.category,
    description: values.description.trim(),
    paymentMethod: values.paymentMethod,
    ...(notes ? { notes } : {})
  };
}
