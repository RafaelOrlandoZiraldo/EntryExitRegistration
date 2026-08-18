import { createContext, useContext } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastInput {
  type: ToastType;
  message: string;
  title?: string;
}

export interface ToastContextValue {
  notify(this: void, toast: ToastInput): void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);

  if (context === null) {
    throw new Error("useToast must be used within ToastProvider.");
  }

  return context;
}
