"use client";
import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCheck, ReceiptText } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { qk, useRestaurant } from "@/lib/queries";
import type { Order, Overview, Page, Table, TableActivity } from "@/lib/types";
import { money, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Stat } from "@/components/dashboard/stat";
import { SimpleBarChart } from "@/components/dashboard/bar-chart";
import { OrderDrawer, WaitTime, itemsSummary, useMarkServed } from "@/components/dashboard/orders";
import { OrderStatusBadge } from "@/components/dashboard/status";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState, ErrorState, Segmented, Skeleton } from "@/components/ui/misc";

export default function OverviewPage() {
  const { user } = useAuth();
  const restaurant = useRestaurant();
  const overview = useQuery({ queryKey: qk.overview, queryFn: () => api<Overview>("/restaurant/analytics/overview"), refetchInterval: 30_000 });
  const pending = useQuery({
    queryKey: qk.orders({ status: "PENDING", size: 6 }),
    queryFn: () => api<Page<Order>>("/restaurant/orders", { query: { status: "PENDING", size: 6 } }),
    refetchInterval: 10_000,
  });
  const recent = useQuery({
    queryKey: qk.orders({ size: 8 }),
    queryFn: () => api<Page<Order>>("/restaurant/orders", { query: { size: 8 } }),
    refetchInterval: 15_000,
  });
  const [range, setRange] = React.useState<"today" | "week">("today");
  const [selected, setSelected] = React.useState<Order | null>(null);
  const markServed = useMarkServed();

  const currency = overview.data?.currency ?? "INR";
  const t = overview.data?.today;
  const hour = new Date().getHours();
  const chartData = range === "today"
    ? (overview.data?.hourly ?? []).map((h) => ({ label: hourLabel(h.hour), value: Number(h.revenue), secondary: h.orders, highlight: h.hour === hour }))
    : (overview.data?.last7Days ?? []).map((d, i, arr) => ({
        label: new Date(d.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" }),
        value: Number(d.revenue), secondary: d.orders, highlight: i === arr.length - 1,
      }));

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.fullName.split(" ")[0] ?? ""}`}
        description={`Here's how ${restaurant.data?.name ?? "your restaurant"} is doing today, ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}.`}
        actions={<Button asChild variant="secondary"><Link href="/dashboard/orders"><ReceiptText /> Open orders</Link></Button>}
      />

      {overview.isError ? <ErrorState message="We couldn't load today's numbers." onRetry={() => overview.refetch()} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {!t ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />) : (
            <>
              <Stat label="Orders today" value={t.orders} delta={{ current: t.orders, previous: t.ordersYesterdaySameTime, minBase: t.ordersYesterdaySameTime }} hint="vs. same time yesterday" />
              <Stat label="Revenue today" value={money(t.revenue, currency)} delta={{ current: Number(t.revenue), previous: Number(t.revenueYesterdaySameTime), minBase: t.ordersYesterdaySameTime }} hint="incl. tax, paid online" />
              <Stat label="Pending orders" value={t.pendingOrders} emphasis={t.pendingOrders > 0} hint={t.pendingOrders ? "waiting to be served" : "all caught up"} />
              <Stat label="Served today" value={t.servedOrders} hint={`Avg. order ${money(t.averageOrderValue, currency)}`} />
            </>
          )}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue"
            description={range === "today" ? "Today, by hour" : "Last 7 days"}
            action={<Segmented value={range} onChange={setRange} options={[{ value: "today", label: "Today" }, { value: "week", label: "7 days" }]} />}
          />
          <div className="px-2 pb-2 pt-3">
            {overview.isLoading ? <Skeleton className="mx-2 h-[220px]" /> : <SimpleBarChart data={chartData} currency={currency} />}
          </div>
        </Card>

        <Card className="flex flex-col">
          <CardHeader
            title="Waiting to be served"
            description="Oldest first"
            action={<Link href="/dashboard/orders" className="text-xs font-medium text-muted hover:text-fg">View all</Link>}
          />
          <div className="flex-1">
            {pending.isLoading ? <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
              : pending.data?.content.length ? (
                <ul className="divide-y divide-border">
                  {pending.data.content.map((o) => (
                    <li key={o.id} className="flex items-center gap-3 px-4 py-2.5">
                      <button onClick={() => setSelected(o)} className="min-w-0 flex-1 text-left focus-ring rounded">
                        <p className="text-[13px] font-medium"><span className="tabular">#{o.orderNumber}</span> · {o.tableName}</p>
                        <p className="truncate text-xs text-muted">{itemsSummary(o, 2)}</p>
                      </button>
                      <WaitTime createdAt={o.createdAt} />
                      <Button size="sm" variant="secondary" aria-label={`Mark order ${o.orderNumber} served`}
                        loading={markServed.isPending && markServed.variables?.id === o.id}
                        onClick={() => markServed.mutate(o)}>Serve</Button>
                    </li>
                  ))}
                </ul>
              ) : <EmptyState icon={CheckCheck} title="All caught up" description="New paid orders will appear here." />}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader title="Recent orders" action={<Link href="/dashboard/orders" className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg">All orders <ArrowRight className="size-3.5" /></Link>} />
          {recent.isLoading ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9" />)}</div>
            : recent.data?.content.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <tbody className="divide-y divide-border">
                    {recent.data.content.map((o) => (
                      <tr key={o.id} onClick={() => setSelected(o)} className="cursor-pointer hover:bg-subtle/60">
                        <td className="tabular whitespace-nowrap py-2.5 pl-4 pr-2 font-medium">#{o.orderNumber}</td>
                        <td className="whitespace-nowrap px-2 text-muted">{o.tableName}</td>
                        <td className="max-w-[260px] truncate px-2 text-muted">{itemsSummary(o, 2)}</td>
                        <td className="tabular whitespace-nowrap px-2 text-right">{money(o.totalAmount, o.currency)}</td>
                        <td className="px-2"><OrderStatusBadge status={o.status} /></td>
                        <td className="whitespace-nowrap py-2.5 pl-2 pr-4 text-right text-xs text-faint">{timeAgo(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={ReceiptText} title="No orders yet" description="Orders appear here as soon as guests pay." />}
        </Card>

        <div className="space-y-6">
          <TableActivityCard />
          <Card>
            <CardHeader title="Top items" description="Last 7 days, by quantity" />
            {overview.isLoading ? <div className="p-4"><Skeleton className="h-28" /></div> : (
              <ol className="divide-y divide-border">
                {(overview.data?.topItems ?? []).map((i, idx) => (
                  <li key={i.name} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                    <span className="tabular w-4 text-faint">{idx + 1}</span>
                    <span className="flex-1 truncate">{i.name}</span>
                    <span className="tabular text-muted">{i.quantity} sold</span>
                  </li>
                ))}
                {overview.data?.topItems.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-muted">No sales yet this week</li>}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <OrderDrawer order={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}

function TableActivityCard() {
  const tables = useQuery({ queryKey: qk.tables, queryFn: () => api<Table[]>("/restaurant/tables") });
  const activity = useQuery({ queryKey: qk.tableActivity, queryFn: () => api<TableActivity[]>("/restaurant/orders/table-activity"), refetchInterval: 15_000 });
  const byTable = new Map((activity.data ?? []).map((a) => [a.tableId, a]));
  const active = (tables.data ?? []).filter((t) => t.active);
  return (
    <Card>
      <CardHeader title="Tables" description="Today's activity" action={<Link href="/dashboard/tables" className="text-xs font-medium text-muted hover:text-fg">Manage</Link>} />
      {tables.isLoading ? <div className="p-4"><Skeleton className="h-24" /></div> : (
        <div className="grid grid-cols-4 gap-1.5 p-3">
          {active.map((t) => {
            const a = byTable.get(t.id);
            const pending = a?.pendingOrders ?? 0;
            return (
              <Link key={t.id} href={`/dashboard/orders?table=${t.id}`}
                title={`${t.name}: ${a?.ordersToday ?? 0} orders today`}
                className={cn("rounded-md border px-2 py-1.5 text-center transition-colors focus-ring",
                  pending ? "border-warning/40 bg-warning-soft" : a?.ordersToday ? "border-border bg-surface hover:bg-subtle" : "border-dashed border-border text-faint hover:bg-subtle")}>
                <p className="truncate text-xs font-medium">{t.name.replace("Table ", "T")}</p>
                <p className={cn("tabular text-[11px]", pending ? "font-semibold text-warning" : "text-faint")}>
                  {pending ? `${pending} pending` : `${a?.ordersToday ?? 0} today`}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function hourLabel(h: number) {
  const suffix = h >= 12 ? "pm" : "am";
  const n = h % 12 === 0 ? 12 : h % 12;
  return `${n}${suffix}`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
