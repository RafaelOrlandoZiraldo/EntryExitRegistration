import type { LucideIcon } from "lucide-react";
import { AlertCircle, Inbox, LoaderCircle } from "lucide-react";
import { cn } from "@shared/lib/utils";
import { Button } from "./button";

interface StateProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
  className?: string;
}

export function LoadingState({
  title = "Cargando",
  message,
  className
}: Partial<Pick<StateProps, "title" | "message" | "className">>) {
  return (
    <section
      aria-live="polite"
      aria-busy="true"
      className={cn("grid min-h-40 place-items-center rounded-lg border border-border bg-card p-6 text-center", className)}
    >
      <div className="grid justify-items-center gap-3">
        <LoaderCircle aria-hidden="true" className="h-6 w-6 animate-spin text-primary" />
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {message ? (
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function EmptyState(props: StateProps) {
  return <BaseState {...props} icon={props.icon ?? Inbox} />;
}

export function ErrorState(props: StateProps) {
  return (
    <BaseState
      {...props}
      icon={props.icon ?? AlertCircle}
      className={cn("border-destructive/40", props.className)}
      role="alert"
    />
  );
}

function BaseState({
  title,
  message,
  actionLabel,
  onAction,
  icon: Icon,
  className,
  role
}: StateProps & { role?: "alert" }) {
  return (
    <section
      role={role}
      className={cn("grid min-h-40 place-items-center rounded-lg border border-border bg-card p-6 text-center", className)}
    >
      <div className="grid max-w-md justify-items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-secondary-foreground">
          <Icon aria-hidden="true" className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {message ? (
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {message}
            </p>
          ) : null}
        </div>
        {actionLabel && onAction ? (
          <Button type="button" variant="outline" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
