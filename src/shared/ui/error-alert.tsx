import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@shared/lib/utils";

export interface ErrorAlertProps {
  title?: string;
  message: string;
  className?: string;
}

export function ErrorAlert({ title, message, className }: ErrorAlertProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    setIsVisible(true);
    const timeoutId = window.setTimeout(() => {
      setIsVisible(false);
    }, 2_000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [message, title]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-x-4 bottom-4 z-[60] mx-auto w-auto max-w-md rounded-lg border border-destructive/40 bg-destructive px-4 py-3 text-sm text-destructive-foreground shadow-lg sm:bottom-6",
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
