"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Check, ChefHat, UtensilsCrossed } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { clock, money } from "@/lib/format";
import type { CustomerOrder } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DietaryMark } from "@/components/dashboard/status";
import { Skeleton } from "@/components/ui/misc";
import { BrandScope, StorefrontMessage } from "@/components/storefront/parts";

export default function OrderConfirmationPage() {
  const { slug, token, orderId } = useParams<{ slug: string; token: string; orderId: string }>();
  const order = useQuery({
    queryKey: ["customer-order", orderId],
    queryFn: () => api<CustomerOrder>(`/public/orders/${orderId}`, { auth: false }),
    refetchInterval: (q) => (q.state.data?.status === "SERVED" ? false : 10_000),
  });

  if (order.isLoading) return <div className="mx-auto max-w-lg space-y-3 bg-white p-6"><Skeleton className="mx-auto size-16 rounded-full" /><Skeleton className="h-8" /><Skeleton className="h-48" /></div>;
  if (order.isError || !order.data) {
    return <StorefrontMessage title="Order not found" description={order.error instanceof ApiError && order.error.status === 404 ? "We couldn't find this order." : "Couldn't load your order. Check your connection."} />;
  }
  const o = order.data;
  const served = o.status === "SERVED";

  return (
    <BrandScope color={o.brandColor} className="min-h-dvh bg-[#f6f5f3]">
      <div className="mx-auto min-h-dvh max-w-lg pb-10">
        <div className="bg-white px-6 pb-7 pt-10 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-600 text-white shadow-[0_8px_24px_-6px_rgb(22_163_74/0.6)]">
            <Check className="size-8" strokeWidth={3} />
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight">{served ? "Enjoy your meal!" : "Order placed"}</h1>
          <p className="mt-1 text-sm text-muted">
            {served ? `Served at ${clock(o.servedAt)}.` : `Payment received. ${o.restaurantName} is preparing your food.`}
          </p>
          <div className="mx-auto mt-6 grid max-w-xs grid-cols-2 divide-x divide-border rounded-2xl border border-border">
            <div className="px-3 py-3"><p className="text-xs text-muted">Order number</p><p className="tabular text-2xl font-bold">#{o.orderNumber}</p></div>
            <div className="px-3 py-3"><p className="text-xs text-muted">Table</p><p className="text-2xl font-bold text-[var(--brand)]">{o.tableName.replace("Table ", "")}</p></div>
          </div>
        </div>

        <section className="mx-4 mt-4 rounded-2xl bg-white p-5 shadow-xs">
          <ol className="relative space-y-5">
            <Step done title="Payment confirmed" time={clock(o.createdAt)} />
            <Step done={served} active={!served} icon={ChefHat} title={served ? "Prepared" : "Being prepared"} time={served ? undefined : "Kitchen has your order"} />
            <Step done={served} icon={UtensilsCrossed} title="Served to your table" time={served ? clock(o.servedAt) : undefined} last />
          </ol>
        </section>

        <section className="mx-4 mt-3 rounded-2xl bg-white p-5 shadow-xs">
          <h2 className="text-sm font-semibold">Order summary</h2>
          <ul className="mt-2 space-y-2">
            {o.items.map((i, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm">
                <DietaryMark dietary={i.dietary} />
                <span className="flex-1">{i.quantity} × {i.name}</span>
                <span className="tabular text-muted">{money(i.lineTotal, o.currency)}</span>
              </li>
            ))}
          </ul>
          <dl className="tabular mt-3 space-y-1 border-t border-dashed border-black/10 pt-3 text-sm">
            <div className="flex justify-between text-muted"><dt>Item total</dt><dd>{money(o.subtotal, o.currency, { decimals: true })}</dd></div>
            <div className="flex justify-between text-muted"><dt>{o.taxLabel}</dt><dd>{money(o.taxAmount, o.currency, { decimals: true })}</dd></div>
            <div className="flex justify-between pt-1 font-bold"><dt>Paid online</dt><dd>{money(o.totalAmount, o.currency, { decimals: true })}</dd></div>
          </dl>
        </section>

        <div className="mx-4 mt-5">
          <Link href={`/r/${slug}/t/${token}`} className="flex h-12 w-full items-center justify-center rounded-xl border border-[var(--brand)] bg-white text-[15px] font-semibold text-[var(--brand)]">
            Order something else
          </Link>
          <p className="mt-3 text-center text-xs text-faint">Need help? Show order #{o.orderNumber} to any staff member.</p>
        </div>
      </div>
    </BrandScope>
  );
}

function Step({ done, active, title, time, icon: Icon = Check, last }: { done?: boolean; active?: boolean; title: string; time?: string; icon?: React.ElementType; last?: boolean }) {
  return (
    <li className="relative flex gap-3">
      {!last && <span className={cn("absolute left-[13px] top-7 h-[calc(100%-4px)] w-0.5", done ? "bg-green-600" : "bg-border")} />}
      <span className={cn("relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full",
        done ? "bg-green-600 text-white" : active ? "bg-[var(--brand)] text-white" : "bg-subtle text-faint")}>
        <Icon className="size-4" strokeWidth={2.5} />
        {active && <span className="absolute inset-0 animate-ping rounded-full bg-[var(--brand)] opacity-30" />}
      </span>
      <div className="pt-0.5">
        <p className={cn("text-sm font-semibold", !done && !active && "text-muted")}>{title}</p>
        {time && <p className="text-xs text-muted">{time}</p>}
      </div>
    </li>
  );
}
