"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { toast } from "sonner";
import {
  ChefHat, CreditCard, LayoutGrid, LogOut, Menu as MenuIcon, QrCode, ReceiptText, Settings, Sparkles, TrendingUp, UtensilsCrossed, X,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, errorMessage } from "@/lib/api";
import { qk, useOrderCounts, useRestaurant } from "@/lib/queries";
import type { Restaurant, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Logo, RestaurantAvatar } from "@/components/logo";
import { Switch } from "@/components/ui/switch";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";

interface NavItem { href: string; label: string; icon: React.ElementType; roles: Role[]; badge?: "pending" }

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid, roles: ["OWNER", "STAFF"] },
  { href: "/dashboard/orders", label: "Orders", icon: ReceiptText, roles: ["OWNER", "STAFF"], badge: "pending" },
  { href: "/dashboard/tables", label: "Tables & QR codes", icon: QrCode, roles: ["OWNER", "STAFF"] },
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed, roles: ["OWNER", "STAFF"] },
  { href: "/dashboard/menu-import", label: "AI menu upload", icon: Sparkles, roles: ["OWNER"] },
  { href: "/dashboard/payments", label: "Payments", icon: CreditCard, roles: ["OWNER"] },
  { href: "/dashboard/insights", label: "Insights", icon: TrendingUp, roles: ["OWNER"] },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, roles: ["OWNER", "STAFF"] },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const pathname = usePathname();
  React.useEffect(() => setMobileOpen(false), [pathname]);
  useNewOrderAlerts();

  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-surface lg:block">
        <SidebarContent />
      </aside>

      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/30 lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 w-64 bg-surface shadow-pop focus:outline-none lg:hidden">
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Dashboard navigation</DialogPrimitive.Description>
            <SidebarContent />
            <DialogPrimitive.Close className="absolute right-3 top-3.5 rounded-md p-1 text-faint hover:bg-subtle" aria-label="Close menu">
              <X className="size-4" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur lg:hidden">
        <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 text-muted hover:bg-subtle focus-ring" aria-label="Open menu">
          <MenuIcon className="size-5" />
        </button>
        <Logo />
        <div className="ml-auto"><OperatingToggle compact /></div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}

function SidebarContent() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const restaurant = useRestaurant();
  const counts = useOrderCounts();
  const items = NAV.filter((n) => user && n.roles.includes(user.role));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Logo />
      </div>
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
          {restaurant.data ? (
            <RestaurantAvatar name={restaurant.data.name} logoUrl={restaurant.data.logoUrl} color={restaurant.data.brandColor} />
          ) : <span className="size-7 rounded-md bg-subtle" />}
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold">{restaurant.data?.name ?? user?.restaurantName ?? "…"}</p>
            <p className="truncate text-xs text-muted">{restaurant.data?.city ?? " "}</p>
          </div>
        </div>
        <div className="mt-1 hidden lg:block"><OperatingToggle /></div>
      </div>

      <nav className="mt-3 flex-1 space-y-0.5 px-3" aria-label="Dashboard">
        {items.map((item) => {
          const active = item.href === "/dashboard" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
          const pending = item.badge === "pending" ? counts.data?.pending ?? 0 : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors focus-ring",
                active ? "bg-subtle text-fg" : "text-muted hover:bg-subtle/70 hover:text-fg",
              )}
            >
              <item.icon className={cn("size-4", active ? "text-fg" : "text-faint")} />
              <span className="flex-1">{item.label}</span>
              {pending > 0 && (
                <span className="tabular rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-[18px] text-white">{pending}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <Dropdown>
          <DropdownTrigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-subtle focus-ring">
            <span className="flex size-7 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-muted ring-1 ring-border">
              {user?.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{user?.fullName}</span>
              <span className="block truncate text-xs text-muted">{user?.role === "OWNER" ? "Owner" : "Staff"}</span>
            </span>
          </DropdownTrigger>
          <DropdownContent align="start" side="top" className="w-56">
            <DropdownLabel>{user?.email}</DropdownLabel>
            <DropdownSeparator />
            <DropdownItem onSelect={() => router.push("/dashboard/settings")}><Settings /> Settings</DropdownItem>
            <DropdownItem onSelect={() => { logout(); router.replace("/login"); }}><LogOut /> Sign out</DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </div>
  );
}

/** "Open for orders" switch. Owners can toggle it; staff see the state. */
function OperatingToggle({ compact }: { compact?: boolean }) {
  const { user } = useAuth();
  const restaurant = useRestaurant();
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (acceptingOrders: boolean) =>
      api<Restaurant>("/restaurant/profile/operating-status", { method: "PATCH", body: { acceptingOrders } }),
    onSuccess: (r) => {
      qc.setQueryData(qk.restaurant, r);
      toast.success(r.acceptingOrders ? "You're open — customers can order" : "Online ordering paused");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const open = restaurant.data?.acceptingOrders ?? false;
  const isOwner = user?.role === "OWNER";
  return (
    <label className={cn("flex items-center gap-2 rounded-md text-[13px]", compact ? "" : "border border-border px-2.5 py-2")}>
      <span className={cn("size-2 rounded-full", open ? "bg-success" : "bg-faint")} />
      <span className={cn("flex-1 font-medium", compact && "hidden sm:inline")}>{open ? "Taking orders" : "Ordering paused"}</span>
      {isOwner && (
        <Switch
          checked={open}
          disabled={!restaurant.data || mutation.isPending}
          onCheckedChange={(v) => mutation.mutate(v)}
          aria-label="Accept online orders"
        />
      )}
    </label>
  );
}

/** Polls order counts and announces newly arrived orders anywhere in the dashboard. */
function useNewOrderAlerts() {
  const counts = useOrderCounts();
  const qc = useQueryClient();
  const router = useRouter();
  const previous = React.useRef<number | null>(null);
  React.useEffect(() => {
    const today = counts.data?.ordersToday;
    if (today === undefined) return;
    if (previous.current !== null && today > previous.current) {
      const n = today - previous.current;
      toast(n === 1 ? "New order received" : `${n} new orders received`, {
        icon: <ChefHat className="size-4" />,
        action: { label: "View", onClick: () => router.push("/dashboard/orders") },
      });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: qk.overview });
    }
    previous.current = today;
  }, [counts.data?.ordersToday, qc, router]);
}
