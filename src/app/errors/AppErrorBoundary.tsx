import React from "react";
import type { ErrorInfo } from "react";
import { ErrorState } from "@shared/ui";
import { reportDevelopmentError } from "./diagnostics";
import { mapErrorToUserMessage } from "./errorMessages";

interface AppErrorBoundaryState {
  error: unknown;
}

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    reportDevelopmentError(error, errorInfo.componentStack);
  }

  render() {
    if (this.state.error !== null) {
      const errorMessage = mapErrorToUserMessage(this.state.error);

      return (
        <main className="mx-auto grid min-h-dvh w-full max-w-2xl place-items-center px-4">
          <ErrorState
            title={errorMessage.title}
            message={
              errorMessage.recoveryAction
                ? `${errorMessage.message} ${errorMessage.recoveryAction}`
                : errorMessage.message
            }
          />
        </main>
      );
    }

    return this.props.children;
  }
}
