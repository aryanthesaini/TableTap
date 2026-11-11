"use client";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Store } from "lucide-react";
import { api } from "@/lib/api";
import type { AdminRestaurant, PlatformOverview } from "@/lib/types";
import { money, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { Stat } from "@/components/dashboard/stat";
import { SimpleBarChart } from "@/components/dashboard/bar-chart";
import { RestaurantAvatar } from "@/components/logo";
import { RestaurantStatusButton } from "@/components/admin";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";

export default function AdminHome() {
  const router = useRouter();
  const overview = useQuery({ queryKey: ["admin", "overview"], queryFn: () => api<PlatformOverview>("/admin/overview"), refetchInterval: 30_000 });
  const restaurants = useQuery({ queryKey: ["admin", "restaurants"], queryFn: () => api<AdminRestaurant[]>("/admin/restaurants"), refetchInterval: 30_000 });
  const o = overview.data;

  return (
    <>
      <PageHeader title="Platform overview" description="All restaurants on TableTap." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!o ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <Stat label="Restaurants" value={o.restaurants} hint={`${o.activeRestaurants} active · ${o.suspendedRestaurants} suspended`} />
            <Stat label="Orders today" value={o.ordersToday} hint="across all restaurants" />
            <Stat label="GMV today" value={money(o.gmvToday, "INR")} hint="paid online" />
            <Stat label="GMV (7 days)" value={money(o.gmv7d, "INR")} hint={`${o.orders7d} orders`} />
          </>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader title="Platform GMV" description="Last 7 days" />
        <div className="px-2 pb-2 pt-3">
          {!o ? <Skeleton className="mx-2 h-[180px]" /> : (
            <SimpleBarChart height={180} currency="INR" data={o.last7Days.map((d, i, arr) => ({
              label: new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
              value: Number(d.gmv), secondary: d.orders, highlight: i === arr.length - 1,
            }))} />
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Restaurants" />
        {restaurants.isError ? <ErrorState onRetry={() => restaurants.refetch()} /> : restaurants.isLoading ? (
          <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !restaurants.data?.length ? <EmptyState icon={Store} title="No restaurants yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="py-2.5 pl-4 pr-2 font-medium">Restaurant</th>
                  <th className="px-2 font-medium">Status</th>
                  <th className="px-2 text-right font-medium">Orders today</th>
                  <th className="px-2 text-right font-medium">Revenue (7d)</th>
                  <th className="px-2 font-medium">Payments</th>
                  <th className="px-2 font-medium">Last order</th>
                  <th className="py-2.5 pl-2 pr-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {restaurants.data.map(({ restaurant: r, stats, paymentStatus, paymentMode }) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-subtle/50" onClick={() => router.push(`/admin/restaurants/${r.id}`)}>
                    <td className="py-3 pl-4 pr-2">
                      <div className="flex items-center gap-2.5">
                        <RestaurantAvatar name={r.name} logoUrl={r.logoUrl} color={r.brandColor} />
                        <div><p className="font-medium">{r.name}</p><p className="text-xs text-muted">{r.city} · {r.cuisine}</p></div>
                      </div>
                    </td>
                    <td className="px-2">{r.status === "ACTIVE" ? <Badge tone="success" dot>Active</Badge> : <Badge tone="danger" dot>Suspended</Badge>}</td>
                    <td className="tabular px-2 text-right">{stats.ordersToday}</td>
                    <td className="tabular px-2 text-right">{money(stats.revenue7d, r.currency)}</td>
                    <td className="px-2">{paymentStatus === "ACTIVE" ? <Badge tone="outline">Razorpay · {paymentMode?.toLowerCase()}</Badge> : <Badge tone="warning">Not connected</Badge>}</td>
                    <td className="px-2 text-muted">{timeAgo(stats.lastOrderAt)}</td>
                    <td className="py-3 pl-2 pr-4 text-right"><RestaurantStatusButton restaurant={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
