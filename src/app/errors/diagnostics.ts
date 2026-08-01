const sensitivePatterns = [
  /password/i,
  /hash/i,
  /salt/i,
  /domestic-finance/i,
  /transactions/i
];

export interface ErrorDiagnostic {
  name: string;
  message: string;
  componentStack?: string;
}

export function createErrorDiagnostic(
  error: unknown,
  componentStack?: string
): ErrorDiagnostic {
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: sanitizeDiagnosticText(
      error instanceof Error ? error.message : "Non-error exception"
    ),
    ...(componentStack
      ? { componentStack: sanitizeDiagnosticText(componentStack) }
      : {})
  };
}

export function reportDevelopmentError(error: unknown, componentStack?: string) {
  if (!import.meta.env.DEV) {
    return;
  }

  console.error("Application error", createErrorDiagnostic(error, componentStack));
}

function sanitizeDiagnosticText(value: string) {
  if (sensitivePatterns.some((pattern) => pattern.test(value))) {
    return "[redacted]";
  }

  return value;
}
