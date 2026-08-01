import { AlertTriangle, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorAlert
} from "@shared/ui";

export interface DeleteAllTransactionsDialogProps {
  open: boolean;
  transactionCount: number;
  onOpenChange(this: void, open: boolean): void;
  onVerifyPassword(this: void, password: string): Promise<unknown>;
  onDeleteAll(this: void): Promise<unknown>;
  onSuccess(this: void): Promise<void>;
  mapError(this: void, error: unknown): { message: string };
}

export function DeleteAllTransactionsDialog({
  open,
  transactionCount,
  onOpenChange,
  onVerifyPassword,
  onDeleteAll,
  onSuccess,
  mapError
}: DeleteAllTransactionsDialogProps) {
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setSubmitError(null);
      setIsDeleting(false);
    }
  }, [open]);

  const confirmDeleteAll = async () => {
    if (isDeleting) {
      return;
    }

    setSubmitError(null);
    setIsDeleting(true);

    try {
      await onVerifyPassword(password);
      await onDeleteAll();
      await onSuccess();
      setPassword("");
      onOpenChange(false);
    } catch (error) {
      setPassword("");
      setSubmitError(mapError(error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eliminar todos los movimientos</DialogTitle>
          <DialogDescription>
            Esta accion elimina todos los movimientos del archivo local.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void confirmDeleteAll();
          }}
        >
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
            <div className="flex gap-3">
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground"
              />
              <div className="grid gap-1 text-sm text-warning-foreground">
                <p className="font-medium">
                  Esta eliminacion es fisica y no se puede deshacer.
                </p>
                <p>
                  Se eliminaran {transactionCount} movimientos guardados.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="delete-all-password">
              Contrasena
            </label>
            <input
              id="delete-all-password"
              autoComplete="current-password"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring"
              disabled={isDeleting}
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
            />
          </div>

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
              disabled={isDeleting || password.length === 0}
              type="submit"
              variant="destructive"
            >
              <Trash2 aria-hidden="true" className="mr-2 h-4 w-4" />
              {isDeleting ? "Eliminando" : "Eliminar todos"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
