import { Link, Outlet, useLocation } from "react-router-dom";
import {
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  ContactRound,
  LayoutDashboard,
  LogOut,
  Menu,
  ShoppingBag,
  ShoppingCart,
  Truck,
  Users,
  WalletCards,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@features/auth";
import { Button } from "@shared/ui/button";

type NavigationItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = auth.session?.role === "admin";
  const navigationItems = useMemo<NavigationItem[]>(
    () =>
      isAdmin
        ? [{ href: "/users", label: "Usuarios", icon: Users }]
        : [
            { href: "/dashboard", label: "Inicio", icon: LayoutDashboard },
            { href: "/transactions", label: "Movimientos", icon: ArrowLeftRight },
            { href: "/catalog", label: "Catalogo", icon: Boxes },
            { href: "/clients", label: "Clientes", icon: ContactRound },
            { href: "/suppliers", label: "Proveedores", icon: Truck },
            { href: "/inventory", label: "Inventario", icon: ClipboardList },
            { href: "/orders", label: "Pedidos", icon: ShoppingCart },
            { href: "/purchase-orders", label: "Compras", icon: ShoppingBag }
          ],
    [isAdmin]
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
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

          <div className="flex items-center justify-end gap-2">
            {auth.session ? (
              <span className="hidden max-w-48 truncate text-sm text-muted-foreground sm:inline">
                {auth.session.username} -{" "}
                {auth.session.role === "admin" ? "Admin" : "Usuario"}
              </span>
            ) : null}
            <Button
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Cerrar menu" : "Abrir menu"}
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => {
                setMobileMenuOpen((open) => !open);
              }}
            >
              {mobileMenuOpen ? (
                <X aria-hidden="true" className="h-5 w-5" />
              ) : (
                <Menu aria-hidden="true" className="h-5 w-5" />
              )}
            </Button>
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

      <div
        aria-hidden={!mobileMenuOpen}
        className={
          mobileMenuOpen
            ? "fixed inset-0 z-50 pointer-events-auto"
            : "fixed inset-0 z-50 pointer-events-none"
        }
      >
        <button
          aria-label="Cerrar menu"
          className={
            mobileMenuOpen
              ? "absolute inset-0 h-full w-full bg-foreground/55 opacity-100 backdrop-blur-sm transition-opacity duration-200"
              : "absolute inset-0 h-full w-full bg-foreground/55 opacity-0 backdrop-blur-sm transition-opacity duration-200"
          }
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
          }}
        />
        <aside
          className={
            mobileMenuOpen
              ? "absolute right-0 top-0 grid h-dvh w-[min(22rem,calc(100vw-2rem))] translate-x-0 grid-rows-[auto_1fr] border-l border-border bg-card text-card-foreground shadow-xl transition-transform duration-200 ease-out"
              : "absolute right-0 top-0 grid h-dvh w-[min(22rem,calc(100vw-2rem))] translate-x-full grid-rows-[auto_1fr] border-l border-border bg-card text-card-foreground shadow-xl transition-transform duration-200 ease-out"
          }
        >
          <div className="flex min-h-16 items-center justify-between gap-3 border-b border-border px-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Secciones</p>
              {auth.session ? (
                <p className="truncate text-xs text-muted-foreground">
                  {auth.session.username} -{" "}
                  {auth.session.role === "admin" ? "Admin" : "Usuario"}
                </p>
              ) : null}
            </div>
            <Button
              aria-label="Cerrar menu"
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => {
                setMobileMenuOpen(false);
              }}
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </Button>
          </div>
          <nav className="grid content-start gap-2 overflow-y-auto p-3">
            {navigationItems.map((item) => (
              <MobileNavigationLink
                key={item.href}
                active={isActivePath(location.pathname, item.href)}
                item={item}
                onNavigate={() => {
                  setMobileMenuOpen(false);
                }}
              />
            ))}
          </nav>
        </aside>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

function MobileNavigationLink({
  active,
  item,
  onNavigate
}: {
  active: boolean;
  item: NavigationItem;
  onNavigate(this: void): void;
}) {
  const Icon = item.icon;

  return (
    <Link
      className={
        active
          ? "flex h-11 items-center gap-3 rounded-md bg-secondary px-3 text-sm font-medium text-secondary-foreground"
          : "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-foreground hover:bg-muted"
      }
      to={item.href}
      onClick={onNavigate}
    >
      <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
      {item.label}
    </Link>
  );
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
