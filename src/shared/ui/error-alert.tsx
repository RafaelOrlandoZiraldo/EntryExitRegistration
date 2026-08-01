import { AlertCircle } from "lucide-react";
import { cn } from "@shared/lib/utils";

export interface ErrorAlertProps {
  title?: string;
  message: string;
  className?: string;
}

export function ErrorAlert({ title, message, className }: ErrorAlertProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive",
        className
      )}
      role="alert"
    >
      <div className="flex gap-2">
        <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          {title ? <p className="font-medium">{title}</p> : null}
          <p className={title ? "mt-1" : undefined}>{message}</p>
        </div>
      </div>
    </div>
  );
}
