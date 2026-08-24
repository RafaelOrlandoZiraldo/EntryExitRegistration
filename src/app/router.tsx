import { Navigate, createBrowserRouter } from "react-router-dom";
import { mapErrorToUserMessage } from "@app/errors/errorMessages";
import { authServices } from "@app/services/auth";
import { catalogServices } from "@app/services/catalog";
import { clientServices } from "@app/services/clients";
import { inventoryServices } from "@app/services/inventory";
import { orderServices } from "@app/services/orders";
import { purchaseOrderServices } from "@app/services/purchaseOrders";
import { transactionServices } from "@app/services/transactions";
import { userServices } from "@app/services/users";
import { AppShell } from "@app/shell/AppShell";
import {
  AdminOnlyRoute,
  HomeRedirect,
  LoginPage,
  ProtectedRoute,
  UserOnlyRoute
} from "@features/auth";
import { CatalogPage } from "@features/catalog";
import { ClientsPage } from "@features/clients";
import { HomePage } from "@features/home/HomePage";
import { InventoryPage } from "@features/inventory";
import { OrdersPage } from "@features/orders";
import { PurchaseOrdersPage } from "@features/purchase-orders";
import { TransactionsPage } from "@features/transactions";
import { UsersPage } from "@features/users";

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
            element: <HomeRedirect />
          },
          {
            element: <UserOnlyRoute />,
            children: [
              {
                path: "dashboard",
                element: (
                  <HomePage
                    catalogService={catalogServices.catalog}
                    getTransactionsUseCase={transactionServices.getTransactions}
                    inventoryService={inventoryServices.inventory}
                    ordersService={orderServices.orders}
                  />
                )
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
              },
              {
                path: "catalog",
                element: (
                  <CatalogPage catalogService={catalogServices.catalog} />
                )
              },
              {
                path: "clients",
                element: (
                  <ClientsPage clientsService={clientServices.clients} />
                )
              },
              {
                path: "inventory",
                element: (
                  <InventoryPage
                    inventoryService={inventoryServices.inventory}
                  />
                )
              },
              {
                path: "orders",
                element: (
                  <OrdersPage
                    clientsService={clientServices.clients}
                    inventoryService={inventoryServices.inventory}
                    ordersService={orderServices.orders}
                  />
                )
              },
              {
                path: "purchase-orders",
                element: (
                  <PurchaseOrdersPage
                    inventoryService={inventoryServices.inventory}
                    purchaseOrdersService={
                      purchaseOrderServices.purchaseOrders
                    }
                  />
                )
              }
            ]
          },
          {
            element: <AdminOnlyRoute />,
            children: [
              {
                path: "users",
                element: <UsersPage usersService={userServices.users} />
              },
              {
                path: "user",
                element: <Navigate to="/users" replace />
              }
            ]
          },
          {
            path: "*",
            element: <HomeRedirect />
          }
        ]
      }
    ]
  }
]);
