import { Link, Outlet } from "react-router-dom";
import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  ShoppingCart,
  Users,
  WalletCards
} from "lucide-react";
import { useAuth } from "@features/auth";
import { Button } from "@shared/ui/button";

export function AppShell() {
  const auth = useAuth();
  const isAdmin = auth.session?.role === "admin";

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <WalletCards aria-hidden="true" className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-5 sm:text-base">
                Registro domestico
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">
                Sesion local
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isAdmin ? (
              <>
                <Button asChild variant="ghost">
                  <Link to="/dashboard">
                    <LayoutDashboard
                      aria-hidden="true"
                      className="mr-2 h-4 w-4"
                    />
                    Inicio
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/transactions">Movimientos</Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/catalog">
                    <Boxes aria-hidden="true" className="mr-2 h-4 w-4" />
                    Catalogo
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/inventory">
                    <ClipboardList aria-hidden="true" className="mr-2 h-4 w-4" />
                    Inventario
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/orders">
                    <ShoppingCart aria-hidden="true" className="mr-2 h-4 w-4" />
                    Pedidos
                  </Link>
                </Button>
                <Button asChild variant="ghost">
                  <Link to="/purchase-orders">
                    <ShoppingBag aria-hidden="true" className="mr-2 h-4 w-4" />
                    Compras
                  </Link>
                </Button>
              </>
            ) : null}
            {isAdmin ? (
              <Button asChild variant="ghost">
                <Link to="/users">
                  <Users aria-hidden="true" className="mr-2 h-4 w-4" />
                  Usuarios
                </Link>
              </Button>
            ) : null}
            {auth.session ? (
              <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:inline">
                {auth.session.username} ·{" "}
                {auth.session.role === "admin" ? "Admin" : "Usuario"}
              </span>
            ) : null}
            <Button
              aria-label="Cerrar sesion"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => {
                void auth.logout();
              }}
            >
              <LogOut aria-hidden="true" className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
