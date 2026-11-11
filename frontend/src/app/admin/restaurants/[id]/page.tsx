"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import type { AdminRestaurant } from "@/lib/types";
import { dateTime, money, timeAgo } from "@/lib/format";
import { Stat } from "@/components/dashboard/stat";
import { RestaurantAvatar } from "@/components/logo";
import { RestaurantStatusButton } from "@/components/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, ErrorState, Skeleton } from "@/components/ui/misc";

export default function AdminRestaurantPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ["admin", "restaurant", id], queryFn: () => api<AdminRestaurant>(`/admin/restaurants/${id}`) });

  if (q.isError) return <ErrorState message="Restaurant not found." onRetry={() => q.refetch()} />;
  if (!q.data) return <Skeleton className="h-96" />;
  const { restaurant: r, stats: s, members, paymentStatus, paymentMode } = q.data;

  return (
    <>
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-[13px] text-muted hover:text-fg"><ArrowLeft className="size-4" /> All restaurants</Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <RestaurantAvatar name={r.name} logoUrl={r.logoUrl} color={r.brandColor} className="size-12 rounded-lg" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">{r.name}</h1>
            {r.status === "ACTIVE" ? <Badge tone="success" dot>Active</Badge> : <Badge tone="danger" dot>Suspended</Badge>}
            {!r.acceptingOrders && r.status === "ACTIVE" && <Badge>Ordering paused</Badge>}
          </div>
          <p className="text-[13px] text-muted">{r.cuisine} · {r.city} · on TableTap since {new Date(r.createdAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
        </div>
        <RestaurantStatusButton restaurant={r} size="md" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders today" value={s.ordersToday} hint={money(s.revenueToday, r.currency)} />
        <Stat label="Last 7 days" value={money(s.revenue7d, r.currency)} hint={`${s.orders7d} orders`} />
        <Stat label="All time" value={money(s.revenueAllTime, r.currency)} hint={`${s.ordersAllTime} orders`} />
        <Stat label="Pending now" value={s.pendingOrders} hint={`Last order ${timeAgo(s.lastOrderAt)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Details" />
          <dl className="divide-y divide-border text-[13px]">
            {[
              ["Slug", <code key="s" className="text-xs">{r.slug}</code>],
              ["Address", [r.addressLine, r.city, r.state, r.postalCode].filter(Boolean).join(", ")],
              ["Phone", r.phone], ["Email", r.email],
              ["Tax", `${r.taxLabel} ${Number(r.taxRatePercent)}%`],
              ["Active tables", s.activeTables], ["Menu items", s.menuItems],
              ["Payments", paymentStatus === "ACTIVE" ? `Razorpay · ${paymentMode?.toLowerCase()} mode` : "Not connected"],
            ].map(([k, v]) => (
              <div key={String(k)} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v ?? "—"}</dd></div>
            ))}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Team" description={`${members?.length ?? 0} members`} />
          <ul className="divide-y divide-border">
            {members?.map((m) => (
              <li key={m.email} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className="flex size-7 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-muted">{m.fullName.split(" ").map((p) => p[0]).join("").slice(0, 2)}</span>
                <div className="min-w-0 flex-1"><p className="font-medium">{m.fullName}</p><p className="truncate text-xs text-muted">{m.email}</p></div>
                <Badge tone="outline">{m.role === "OWNER" ? "Owner" : "Staff"}</Badge>
                <span className="hidden w-32 text-right text-xs text-faint sm:block">{m.lastLoginAt ? `Seen ${dateTime(m.lastLoginAt)}` : "Never signed in"}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
