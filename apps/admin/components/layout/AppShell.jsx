"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  MessageSquare,
  Mail,
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
  CreditCard,
} from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { api } from "@/lib/api/client";
import NotificationBell from "./NotificationBell";

// Same poll-for-a-count approach as NotificationBell's register-reopen
// badge — this app has no websocket/SSE infrastructure, so a short interval
// is how a newly-submitted low-rated review (1-3 stars, held for moderation)
// surfaces on the Products nav item without a full page reload. Also used
// for the Messages nav item's unread count (new /contact submissions).
const REVIEW_POLL_MS = 20000;

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, permission: "reports:read" },
  { label: "Products", href: "/products", icon: Package, permission: "catalog:read", countKey: "pendingReviews" },
  { label: "Inventory", href: "/inventory", icon: Boxes, permission: "inventory:read" },
  { label: "Purchase Orders", href: "/purchasing", icon: ClipboardList, permission: "purchasing:read" },
  { label: "Messages", href: "/messages", icon: Mail, permission: "messages:read", countKey: "unreadMessages" },
  { label: "Suppliers", href: "/suppliers", icon: Users, permission: "purchasing:read" },
  { label: "Orders", href: "/orders", icon: ShoppingCart, permission: "orders:read" },
  { label: "Payments", href: "/payments", icon: CreditCard, permission: "reports:read" },
  { label: "Deliveries", href: "/deliveries", icon: Truck, permission: "orders:read" },
  { label: "Registers", href: "/registers", icon: MonitorSmartphone, permission: "pos:register:approve-reopen" },
  { label: "Reports", href: "/reports", icon: BarChart3, permission: "reports:read" },
  { label: "Users", href: "/users", icon: UserCog, permission: "users:manage" },
  { label: "Settings", href: "/settings", icon: Settings, permission: null },
];

function NavLink({ item, pathname, onClick, count }) {
  // A product with a 1-3 star review awaiting moderation (see
  // ProductReviewsTab.jsx) swaps Products' normal Package icon for a review
  // icon with the pending count fused directly onto it — not a separate
  // floating pill next to the label — so the icon itself reads as "reviews
  // need attention" at a glance. Reverts to the plain Package icon (no
  // badge at all) once nothing is pending. This icon swap is specific to
  // Products (countKey "pendingReviews") — every other badge-carrying item
  // (e.g. Messages) just gets the small count pill next to its own icon.
  const hasAlert = count > 0;
  const Icon = hasAlert && item.countKey === "pendingReviews" ? MessageSquare : item.icon;
  const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? "bg-brand-gold text-brand-charcoal" : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="relative inline-flex shrink-0">
        <Icon className="size-4.5" aria-hidden="true" />
        {hasAlert && (
          <span className="absolute -right-1.5 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-brand-red text-[9px] font-bold leading-none text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </span>
      <span className="flex-1">{item.label}</span>
    </Link>
  );
}

function SidebarContent({ pathname, onNavigate }) {
  const { user, logout, hasPermission } = useAuth();
  const router = useRouter();
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const canReadMessages = hasPermission("messages:read");

  const loadPendingReviewCount = useCallback(() => {
    api
      .get("/catalog/admin/reviews/pending-count")
      .then((data) => setPendingReviewCount(data.count))
      .catch(() => {
        // Silent — this is a background badge, not a page the admin is
        // actively waiting on, same reasoning as NotificationBell's load().
      });
  }, []);

  const loadUnreadMessageCount = useCallback(() => {
    if (!canReadMessages) return;
    api
      .get("/messages/counts")
      .then((data) => setUnreadMessageCount(data.unread))
      .catch(() => {
        // Silent — same reasoning as loadPendingReviewCount above.
      });
  }, [canReadMessages]);

  useEffect(() => {
    loadPendingReviewCount();
    const interval = setInterval(loadPendingReviewCount, REVIEW_POLL_MS);
    return () => clearInterval(interval);
  }, [loadPendingReviewCount]);

  useEffect(() => {
    loadUnreadMessageCount();
    const interval = setInterval(loadUnreadMessageCount, REVIEW_POLL_MS);
    return () => clearInterval(interval);
  }, [loadUnreadMessageCount]);

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission));
  const countsByKey = { pendingReviews: pendingReviewCount, unreadMessages: unreadMessageCount };

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto bg-brand-navy p-4">
      <div className="px-2 pt-1">
        <span className="font-display text-lg font-bold text-brand-gold">BIG ED OS</span>
        <p className="text-xs text-white/50">Retail operations</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
        {visibleItems.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            onClick={onNavigate}
            count={item.countKey ? countsByKey[item.countKey] : 0}
          />
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
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-black/10 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-2 text-brand-charcoal hover:bg-black/5 lg:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <span className="flex-1 font-display text-base font-bold text-brand-red lg:hidden">BIG ED OS</span>
          <div className="ml-auto flex items-center gap-2">
            {(hasPermission("reports:read") ||
              hasPermission("pos:register:approve-reopen") ||
              hasPermission("messages:read")) && <NotificationBell />}
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
