import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
  type LucideIcon
} from "lucide-react";
import {
  useCallback,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { cn } from "@shared/lib/utils";
import { ToastContext, type ToastInput, type ToastType } from "./toast-context";

interface ToastMessage extends ToastInput {
  id: string;
}

const toastDurationMs = 2_000;

const toastStyles: Record<
  ToastType,
  { icon: LucideIcon; className: string; title: string }
> = {
  success: {
    icon: CheckCircle2,
    className: "border-success/40 bg-success text-success-foreground",
    title: "Exito"
  },
  error: {
    icon: XCircle,
    className: "border-destructive/40 bg-destructive text-destructive-foreground",
    title: "Error"
  },
  warning: {
    icon: AlertTriangle,
    className: "border-warning/50 bg-warning text-warning-foreground",
    title: "Advertencia"
  },
  info: {
    icon: Info,
    className: "border-primary/40 bg-primary text-primary-foreground",
    title: "Informacion"
  }
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((toast: ToastInput) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { ...toast, id }]);

    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, toastDurationMs);
  }, []);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="fixed inset-x-0 bottom-4 z-[60] grid justify-items-center gap-2 px-4 sm:bottom-6"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast }: { toast: ToastMessage }) {
  const style = toastStyles[toast.type];
  const Icon = style.icon;

  return (
    <div
      className={cn(
        "w-full max-w-md rounded-lg border px-4 py-3 text-sm shadow-lg",
        style.className
      )}
      role={toast.type === "error" || toast.type === "warning" ? "alert" : "status"}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{toast.title ?? style.title}</p>
          <p className="mt-1 leading-5">{toast.message}</p>
        </div>
      </div>
    </div>
  );
}
