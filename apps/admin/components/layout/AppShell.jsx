"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ClipboardList,
  Users,
  UserCog,
  ShoppingCart,
  Truck,
  BarChart3,
  Settings,
  Menu,
  LogOut,
  MonitorSmartphone,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import NotificationBell from "./NotificationBell";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, permission: "reports:read" },
  { label: "Products", href: "/products", icon: Package, permission: "catalog:read" },
  { label: "Inventory", href: "/inventory", icon: Boxes, permission: "inventory:read" },
  { label: "Purchase Orders", href: "/purchasing", icon: ClipboardList, permission: "purchasing:read" },
  { label: "Suppliers", href: "/suppliers", icon: Users, permission: "purchasing:read" },
  { label: "Orders", href: "/orders", icon: ShoppingCart, permission: "orders:read" },
  { label: "Deliveries", href: "/deliveries", icon: Truck, permission: "orders:read" },
  { label: "Registers", href: "/registers", icon: MonitorSmartphone, permission: "pos:register:approve-reopen" },
  { label: "Reports", href: "/reports", icon: BarChart3, permission: "reports:read" },
  { label: "Users", href: "/users", icon: UserCog, permission: "users:manage" },
  { label: "Settings", href: "/settings", icon: Settings, permission: null },
];

function NavLink({ item, pathname, onClick }) {
  const Icon = item.icon;
  const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-brand-gold text-brand-charcoal" : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="size-4.5 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

function SidebarContent({ pathname, onNavigate }) {
  const { user, logout, hasPermission } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto bg-brand-navy p-4">
      <div className="flex items-start justify-between gap-2 px-2 pt-1">
        <div>
          <span className="font-display text-lg font-bold text-brand-gold">BIG ED OS</span>
          <p className="text-xs text-white/50">Retail operations</p>
        </div>
        {hasPermission("pos:register:approve-reopen") && <NotificationBell onNavigate={onNavigate} />}
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
        {visibleItems.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onClick={onNavigate} />
        ))}
      </nav>

      <div className="border-t border-white/10 pt-4">
        <p className="truncate px-2 text-sm font-semibold text-white">
          {user ? `${user.firstName} ${user.lastName}` : ""}
        </p>
        <p className="truncate px-2 text-xs text-white/50">{user?.roles?.join(", ")}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function AppShell({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { hasPermission } = useAuth();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="fixed h-screen w-64">
          <SidebarContent pathname={pathname} />
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%]">
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-black/10 bg-white px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-brand-charcoal hover:bg-black/5"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <span className="flex-1 font-display text-base font-bold text-brand-red">BIG ED OS</span>
          {hasPermission("pos:register:approve-reopen") && <NotificationBell />}
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
