"use client";
import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Clock, MessageSquareText } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { Order } from "@/lib/types";
import { clock, dateTime, minutesSince, money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/dialog";
import { DietaryMark, OrderStatusBadge, PaymentStatusBadge } from "./status";

export function useMarkServed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: Order) => api<Order>(`/restaurant/orders/${order.id}/serve`, { method: "POST" }),
    onSuccess: (o) => {
      toast.success(`Order #${o.orderNumber} marked as served`);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: (e) => toast.error(errorMessage(e, "Couldn't update the order")),
  });
}

/** Waiting time chip: neutral → amber after 15 min → red after 25 min. */
export function WaitTime({ createdAt, className }: { createdAt: string; className?: string }) {
  const [, tick] = React.useState(0);
  React.useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30_000); return () => clearInterval(t); }, []);
  const m = minutesSince(createdAt);
  return (
    <span className={cn("tabular inline-flex items-center gap-1 text-xs font-medium",
      m >= 25 ? "text-danger" : m >= 15 ? "text-warning" : "text-muted", className)}>
      <Clock className="size-3.5" />{m < 1 ? "now" : `${m} min`}
    </span>
  );
}

export function itemsSummary(order: Order, max = 3) {
  const parts = order.items.map((i) => `${i.quantity}× ${i.name}`);
  return parts.length > max ? `${parts.slice(0, max).join(", ")} +${parts.length - max} more` : parts.join(", ");
}

export function OrderDrawer({ order, onOpenChange }: { order: Order | null; onOpenChange: (open: boolean) => void }) {
  const markServed = useMarkServed();
  const [current, setCurrent] = React.useState<Order | null>(order);
  React.useEffect(() => { if (order) setCurrent(order); }, [order]);
  const o = current;

  return (
    <Drawer
      open={!!order}
      onOpenChange={onOpenChange}
      title={o ? <span className="tabular">Order #{o.orderNumber}</span> : "Order"}
      description={o ? `${o.tableName} · ${dateTime(o.createdAt)}` : undefined}
      footer={o && (o.status === "PENDING" ? (
        <Button variant="primary" className="w-full" size="lg" loading={markServed.isPending}
          onClick={() => markServed.mutate(o, { onSuccess: (updated) => { setCurrent(updated); onOpenChange(false); } })}>
          <Check /> Mark as served
        </Button>
      ) : (
        <p className="py-1.5 text-center text-[13px] text-muted">Served at {clock(o.servedAt)}</p>
      ))}
    >
      {o && (
        <div className="px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={o.status} />
            <PaymentStatusBadge status={o.paymentStatus} />
            {o.status === "PENDING" && <WaitTime createdAt={o.createdAt} className="ml-auto" />}
          </div>

          {o.customerNote && (
            <div className="mt-4 flex gap-2 rounded-md border border-warning/20 bg-warning-soft px-3 py-2.5 text-[13px]">
              <MessageSquareText className="mt-0.5 size-4 shrink-0 text-warning" />
              <p><span className="font-medium">Note from guest:</span> {o.customerNote}</p>
            </div>
          )}

          <h3 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-faint">Items</h3>
          <ul className="divide-y divide-border rounded-md border border-border">
            {o.items.map((i, idx) => (
              <li key={idx} className="flex items-start gap-3 px-3 py-2.5">
                <span className="tabular mt-px min-w-[28px] rounded bg-subtle px-1.5 text-center text-[13px] font-semibold">{i.quantity}×</span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-medium"><DietaryMark dietary={i.dietary} />{i.name}</p>
                  <p className="tabular text-xs text-muted">{money(i.unitPrice, o.currency)} each</p>
                </div>
                <span className="tabular text-[13px]">{money(i.lineTotal, o.currency)}</span>
              </li>
            ))}
          </ul>

          <dl className="tabular mt-4 space-y-1.5 text-[13px]">
            <div className="flex justify-between text-muted"><dt>Subtotal</dt><dd>{money(o.subtotal, o.currency, { decimals: true })}</dd></div>
            <div className="flex justify-between text-muted"><dt>Tax</dt><dd>{money(o.taxAmount, o.currency, { decimals: true })}</dd></div>
            <div className="flex justify-between border-t border-border pt-2 text-[15px] font-semibold"><dt>Total paid</dt><dd>{money(o.totalAmount, o.currency, { decimals: true })}</dd></div>
          </dl>

          <h3 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wide text-faint">Timeline</h3>
          <ol className="space-y-2 text-[13px]">
            <li className="flex gap-2"><span className="mt-1.5 size-1.5 rounded-full bg-success" /><span className="flex-1">Paid online & order placed</span><span className="text-muted">{clock(o.createdAt)}</span></li>
            <li className="flex gap-2">
              <span className={cn("mt-1.5 size-1.5 rounded-full", o.servedAt ? "bg-success" : "bg-border-strong")} />
              <span className={cn("flex-1", !o.servedAt && "text-muted")}>Served to {o.tableName}</span>
              <span className="text-muted">{o.servedAt ? clock(o.servedAt) : "—"}</span>
            </li>
          </ol>
          <p className="mt-6 font-mono text-[11px] text-faint">ID {o.id}</p>
        </div>
      )}
    </Drawer>
  );
}
