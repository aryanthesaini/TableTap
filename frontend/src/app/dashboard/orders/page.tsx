"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, CheckCheck, LayoutGrid, MessageSquareText, ReceiptText, Rows3, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { qk, useOrderCounts } from "@/lib/queries";
import type { Order, OrderStatus, Page, Table } from "@/lib/types";
import { dateTime, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { OrderDrawer, WaitTime, itemsSummary, useMarkServed } from "@/components/dashboard/orders";
import { DietaryMark, OrderStatusBadge, PaymentStatusBadge } from "@/components/dashboard/status";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, EmptyState, ErrorState, Segmented, Skeleton } from "@/components/ui/misc";

type Tab = "PENDING" | "SERVED" | "ALL";
const PAGE_SIZE = 25;

export default function OrdersPage() {
  return (
    <React.Suspense fallback={null}>
      <OrdersView />
    </React.Suspense>
  );
}

function OrdersView() {
  const params = useSearchParams();
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>((params.get("status") as Tab) ?? "PENDING");
  const [tableId, setTableId] = React.useState(params.get("table") ?? "");
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [groupByTable, setGroupByTable] = React.useState(false);
  const [selected, setSelected] = React.useState<Order | null>(null);

  React.useEffect(() => { const t = setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(t); }, [search]);
  React.useEffect(() => { setPage(0); }, [tab, tableId, query]);
  React.useEffect(() => {
    const sp = new URLSearchParams();
    if (tab !== "PENDING") sp.set("status", tab);
    if (tableId) sp.set("table", tableId);
    router.replace(`/dashboard/orders${sp.size ? `?${sp}` : ""}`, { scroll: false });
  }, [tab, tableId, router]);

  const counts = useOrderCounts();
  const tables = useQuery({ queryKey: qk.tables, queryFn: () => api<Table[]>("/restaurant/tables") });
  const status: OrderStatus | undefined = tab === "ALL" ? undefined : tab;
  const listParams = { status, tableId: tableId || undefined, q: query || undefined, page, size: tab === "PENDING" ? 100 : PAGE_SIZE };
  const orders = useQuery({
    queryKey: qk.orders(listParams),
    queryFn: () => api<Page<Order>>("/restaurant/orders", { query: listParams }),
    placeholderData: keepPreviousData,
    refetchInterval: tab === "PENDING" ? 8_000 : 30_000,
  });

  const filtersActive = !!tableId || !!query;

  return (
    <>
      <PageHeader title="Orders" description="Every paid order from your tables. Pending orders refresh automatically." />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "PENDING", label: "Pending", count: counts.data?.pending },
            { value: "SERVED", label: "Served" },
            { value: "ALL", label: "All orders" },
          ]}
        />
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order #, item or table" className="pl-8" aria-label="Search orders" />
          </div>
          <Select value={tableId} onChange={(e) => setTableId(e.target.value)} className="w-40" aria-label="Filter by table">
            <option value="">All tables</option>
            {(tables.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={() => { setTableId(""); setSearch(""); }}><X /> Clear</Button>
          )}
          {tab === "PENDING" && (
            <div className="hidden rounded-md border border-border p-0.5 sm:flex">
              <button aria-label="Show as list" aria-pressed={!groupByTable} onClick={() => setGroupByTable(false)}
                className={cn("rounded-[5px] p-1.5 focus-ring", !groupByTable ? "bg-subtle text-fg" : "text-faint hover:text-fg")}><LayoutGrid className="size-4" /></button>
              <button aria-label="Group by table" aria-pressed={groupByTable} onClick={() => setGroupByTable(true)}
                className={cn("rounded-[5px] p-1.5 focus-ring", groupByTable ? "bg-subtle text-fg" : "text-faint hover:text-fg")}><Rows3 className="size-4" /></button>
            </div>
          )}
        </div>
      </div>

      {orders.isError ? <Card><ErrorState message="Orders couldn't be loaded." onRetry={() => orders.refetch()} /></Card>
        : orders.isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-44" />)}</div>
        ) : tab === "PENDING" ? (
          <PendingBoard orders={orders.data!.content} grouped={groupByTable} onOpen={setSelected} filtersActive={filtersActive} />
        ) : (
          <OrderTable data={orders.data!} onOpen={setSelected} page={page} setPage={setPage} filtersActive={filtersActive} />
        )}

      <OrderDrawer order={selected} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}

function PendingBoard({ orders, grouped, onOpen, filtersActive }: { orders: Order[]; grouped: boolean; onOpen: (o: Order) => void; filtersActive: boolean }) {
  if (!orders.length) {
    return (
      <Card>
        <EmptyState icon={CheckCheck} title={filtersActive ? "No pending orders match" : "All orders are served"}
          description={filtersActive ? "Try a different search or table." : "New paid orders will appear here automatically."} />
      </Card>
    );
  }
  if (!grouped) {
    return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{orders.map((o) => <Ticket key={o.id} order={o} onOpen={onOpen} />)}</div>;
  }
  const groups = new Map<string, Order[]>();
  orders.forEach((o) => groups.set(o.tableName, [...(groups.get(o.tableName) ?? []), o]));
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([table, list]) => (
        <section key={table}>
          <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
            {table}
            <span className="tabular rounded-full bg-subtle px-2 text-xs font-medium text-muted">{list.length} {list.length === 1 ? "order" : "orders"}</span>
            <span className="tabular text-xs font-normal text-faint">· {money(list.reduce((s, o) => s + Number(o.totalAmount), 0), list[0].currency)}</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map((o) => <Ticket key={o.id} order={o} onOpen={onOpen} />)}</div>
        </section>
      ))}
    </div>
  );
}

/** Kitchen-ticket style card for a pending order. */
function Ticket({ order, onOpen }: { order: Order; onOpen: (o: Order) => void }) {
  const markServed = useMarkServed();
  return (
    <Card className="flex flex-col">
      <button onClick={() => onOpen(order)} className="flex-1 rounded-t-lg px-4 pb-3 pt-3.5 text-left hover:bg-subtle/40 focus-ring">
        <div className="flex items-center justify-between">
          <p className="text-[15px] font-semibold"><span className="tabular">#{order.orderNumber}</span></p>
          <WaitTime createdAt={order.createdAt} />
        </div>
        <p className="mt-0.5 text-[13px] font-medium text-accent">{order.tableName}</p>
        <ul className="mt-3 space-y-1">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex items-center gap-2 text-[13px]">
              <span className="tabular w-6 font-semibold">{i.quantity}×</span>
              <DietaryMark dietary={i.dietary} />
              <span className="truncate">{i.name}</span>
            </li>
          ))}
        </ul>
        {order.customerNote && (
          <p className="mt-3 flex gap-1.5 rounded bg-warning-soft px-2 py-1.5 text-xs text-fg">
            <MessageSquareText className="mt-px size-3.5 shrink-0 text-warning" />{order.customerNote}
          </p>
        )}
      </button>
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
        <span className="tabular text-[13px] text-muted">{money(order.totalAmount, order.currency)} · <span className="text-success">Paid</span></span>
        <Button size="sm" variant="primary" loading={markServed.isPending} onClick={() => markServed.mutate(order)}>
          <Check /> Served
        </Button>
      </div>
    </Card>
  );
}

function OrderTable({ data, onOpen, page, setPage, filtersActive }: {
  data: Page<Order>; onOpen: (o: Order) => void; page: number; setPage: (p: number) => void; filtersActive: boolean;
}) {
  if (!data.content.length) {
    return <Card><EmptyState icon={ReceiptText} title={filtersActive ? "No orders match" : "No orders yet"} description={filtersActive ? "Try a different search or table." : undefined} /></Card>;
  }
  const from = data.page * data.size + 1;
  const to = from + data.content.length - 1;
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted">
              <th className="py-2.5 pl-4 pr-2 font-medium">Order</th>
              <th className="px-2 font-medium">Table</th>
              <th className="px-2 font-medium">Items</th>
              <th className="px-2 text-right font-medium">Amount</th>
              <th className="px-2 font-medium">Payment</th>
              <th className="px-2 font-medium">Status</th>
              <th className="py-2.5 pl-2 pr-4 text-right font-medium">Placed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.content.map((o) => (
              <tr key={o.id} className="cursor-pointer hover:bg-subtle/60" onClick={() => onOpen(o)} tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onOpen(o)}>
                <td className="tabular whitespace-nowrap py-2.5 pl-4 pr-2 font-medium">#{o.orderNumber}</td>
                <td className="whitespace-nowrap px-2">{o.tableName}</td>
                <td className="max-w-[320px] truncate px-2 text-muted">{itemsSummary(o)}</td>
                <td className="tabular whitespace-nowrap px-2 text-right">{money(o.totalAmount, o.currency, { decimals: true })}</td>
                <td className="px-2"><PaymentStatusBadge status={o.paymentStatus} /></td>
                <td className="px-2"><OrderStatusBadge status={o.status} /></td>
                <td className="whitespace-nowrap py-2.5 pl-2 pr-4 text-right text-muted">{dateTime(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted">
        <span className="tabular">{from}–{to} of {data.totalElements}</span>
        <div className="flex gap-1">
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft /></Button>
          <Button size="sm" variant="secondary" disabled={page + 1 >= data.totalPages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight /></Button>
        </div>
      </div>
    </Card>
  );
}
