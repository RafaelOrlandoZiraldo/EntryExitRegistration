import { RouterProvider } from "react-router-dom";
import { AppErrorBoundary } from "@app/errors/AppErrorBoundary";
import { router } from "@app/router";
import { createBrowserAuthDependencies } from "@app/services/auth";
import { AuthProvider } from "@features/auth";

const authDependencies = createBrowserAuthDependencies();

export function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider dependencies={authDependencies}>
        <RouterProvider router={router} />
      </AuthProvider>
    </AppErrorBoundary>
  );
}
