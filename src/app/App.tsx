import { RouterProvider } from "react-router-dom";
import { AppErrorBoundary } from "@app/errors/AppErrorBoundary";
import { router } from "@app/router";
import { authServices } from "@app/services/auth";
import { DailyBackupRunner } from "@app/services/DailyBackupRunner";
import { transactionServices } from "@app/services/transactions";
import { AuthProvider } from "@features/auth";

export function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider dependencies={authServices.dependencies}>
        <DailyBackupRunner
          createDailyBackupUseCase={transactionServices.createDailyBackup}
        />
        <RouterProvider router={router} />
      </AuthProvider>
    </AppErrorBoundary>
  );
}
