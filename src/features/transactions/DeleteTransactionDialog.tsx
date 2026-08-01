import { AlertTriangle, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { FinancialTransaction } from "@domain/transactions";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorAlert,
  TransactionTypeBadge
} from "@shared/ui";
import {
  formatTransactionAmount,
  formatTransactionDate
} from "./formatters";

export interface DeleteTransactionDialogProps {
  open: boolean;
  transaction: FinancialTransaction | null;
  onOpenChange(this: void, open: boolean): void;
  onDelete(this: void, id: string): Promise<unknown>;
  onSuccess(this: void): Promise<void>;
  mapError(this: void, error: unknown): { message: string };
}

export function DeleteTransactionDialog({
  open,
  transaction,
  onOpenChange,
  onDelete,
  onSuccess,
  mapError
}: DeleteTransactionDialogProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setSubmitError(null);
      setIsDeleting(false);
    }
  }, [open]);

  const confirmDelete = async () => {
    if (transaction === null || isDeleting) {
      return;
    }

    setSubmitError(null);
    setIsDeleting(true);

    try {
      await onDelete(transaction.id);
      await onSuccess();
      onOpenChange(false);
    } catch (error) {
      setSubmitError(mapError(error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar movimiento</DialogTitle>
          <DialogDescription>
            Esta accion elimina el movimiento del archivo local.
          </DialogDescription>
        </DialogHeader>

        {transaction ? (
          <div className="grid gap-4">
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
              <div className="flex gap-3">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground"
                />
                <p className="text-sm font-medium text-warning-foreground">
                  Esta eliminacion es fisica y no se puede deshacer.
                </p>
              </div>
            </div>

            <dl className="grid gap-3 rounded-lg border border-border bg-background p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Tipo</dt>
                <dd>
                  <TransactionTypeBadge type={transaction.type} />
                </dd>
              </div>
              <DetailRow label="Descripcion" value={transaction.description} />
              <DetailRow
                label="Fecha"
                value={formatTransactionDate(transaction.date)}
              />
              <DetailRow
                label="Importe"
                value={formatTransactionAmount(transaction.amount)}
              />
            </dl>

            {submitError ? <ErrorAlert message={submitError} /> : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                disabled={isDeleting}
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={isDeleting}
                type="button"
                variant="destructive"
                onClick={() => {
                  void confirmDelete();
                }}
              >
                <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
                {isDeleting ? "Eliminando" : "Eliminar definitivamente"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
