import { Navigate, createBrowserRouter } from "react-router-dom";
import { mapErrorToUserMessage } from "@app/errors/errorMessages";
import { authServices } from "@app/services/auth";
import { transactionServices } from "@app/services/transactions";
import { AppShell } from "@app/shell/AppShell";
import { LoginPage, ProtectedRoute } from "@features/auth";
import { TransactionsPage } from "@features/transactions";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage mapError={mapErrorToUserMessage} />
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <Navigate to="/transactions" replace />
          },
          {
            path: "transactions",
            element: (
              <TransactionsPage
                createTransactionUseCase={
                  transactionServices.createTransaction
                }
                deleteTransactionUseCase={
                  transactionServices.deleteTransaction
                }
                deleteAllTransactionsUseCase={
                  transactionServices.deleteAllTransactions
                }
                downloadFile={transactionServices.downloadFile}
                exportStorageDocumentUseCase={
                  transactionServices.exportStorageDocument
                }
                getTransactionsUseCase={transactionServices.getTransactions}
                importStorageDocumentUseCase={
                  transactionServices.importStorageDocument
                }
                mapError={mapErrorToUserMessage}
                previewImportStorageDocumentUseCase={
                  transactionServices.previewImportStorageDocument
                }
                updateTransactionUseCase={
                  transactionServices.updateTransaction
                }
                verifyPasswordUseCase={authServices.verifyPassword}
              />
            )
          }
        ]
      }
    ]
  }
]);
