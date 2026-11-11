"use client";
import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Copy, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { qk } from "@/lib/queries";
import type { Page, Payment, PaymentStatus, PaymentSummary } from "@/lib/types";
import { dateTime, money } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { Stat } from "@/components/dashboard/stat";
import { PaymentStatusBadge } from "@/components/dashboard/status";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, ErrorState, Segmented, Skeleton } from "@/components/ui/misc";

type Filter = "ALL" | PaymentStatus;

export default function PaymentsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [page, setPage] = React.useState(0);
  React.useEffect(() => setPage(0), [filter]);
  const enabled = user?.role === "OWNER";

  const summary = useQuery({ queryKey: qk.paymentSummary, queryFn: () => api<PaymentSummary>("/restaurant/payments/summary", { query: { days: 7 } }), enabled });
  const params = { status: filter === "ALL" ? undefined : filter, page, size: 25 };
  const payments = useQuery({
    queryKey: qk.payments(params), queryFn: () => api<Page<Payment>>("/restaurant/payments", { query: params }),
    placeholderData: keepPreviousData, enabled, refetchInterval: 20_000,
  });

  if (!enabled) return <Card><EmptyState icon={CreditCard} title="Owners only" description="Payment records are visible to restaurant owners." /></Card>;

  const s = summary.data;
  return (
    <>
      <PageHeader title="Payments" description="Online payments made by guests, settled directly to your Razorpay account." />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!s ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <Stat label="Collected (7 days)" value={money(s.capturedAmount, "INR")} hint={`${s.capturedCount} successful payments`} />
            <Stat label="Success rate" value={`${s.successRate}%`} hint="captured vs. failed" />
            <Stat label="Failed" value={s.failedCount} hint="no order created" />
            <Stat label="In progress" value={s.pendingCount} hint="awaiting confirmation" />
          </>
        )}
      </div>

      <Segmented className="mb-4" value={filter} onChange={setFilter} options={[
        { value: "ALL", label: "All" }, { value: "CAPTURED", label: "Paid" }, { value: "FAILED", label: "Failed" }, { value: "PENDING", label: "Pending" },
      ]} />

      <Card>
        {payments.isError ? <ErrorState onRetry={() => payments.refetch()} /> : payments.isLoading ? (
          <div className="space-y-2 p-4">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-9" />)}</div>
        ) : !payments.data?.content.length ? <EmptyState icon={CreditCard} title="No payments" description="Payments appear here as guests check out." /> : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="py-2.5 pl-4 pr-2 font-medium">Payment ID</th>
                    <th className="px-2 font-medium">Order</th>
                    <th className="px-2 text-right font-medium">Amount</th>
                    <th className="px-2 font-medium">Method</th>
                    <th className="px-2 font-medium">Status</th>
                    <th className="py-2.5 pl-2 pr-4 text-right font-medium">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payments.data.content.map((p) => (
                    <tr key={p.id} className="hover:bg-subtle/40">
                      <td className="py-2.5 pl-4 pr-2">
                        <button className="group inline-flex items-center gap-1.5 font-mono text-xs text-fg" title="Copy payment ID"
                          onClick={() => navigator.clipboard.writeText(p.providerPaymentId ?? p.id).then(() => toast.success("Copied"))}>
                          {p.providerPaymentId ?? p.providerOrderId}
                          <Copy className="size-3 text-faint opacity-0 group-hover:opacity-100" />
                        </button>
                      </td>
                      <td className="tabular px-2">{p.orderNumber ? `#${p.orderNumber}` : <span className="text-faint">—</span>}</td>
                      <td className="tabular whitespace-nowrap px-2 text-right font-medium">{money(p.amount, p.currency, { decimals: true })}</td>
                      <td className="px-2 text-muted">{p.method ?? "—"}</td>
                      <td className="px-2">
                        <div className="flex items-center gap-2">
                          <PaymentStatusBadge status={p.status} />
                          {p.failureReason && <span className="max-w-[200px] truncate text-xs text-muted" title={p.failureReason}>{p.failureReason}</span>}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pl-2 pr-4 text-right text-muted">{dateTime(p.capturedAt ?? p.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted">
              <span className="tabular">Page {payments.data.page + 1} of {Math.max(1, payments.data.totalPages)} · {payments.data.totalElements} payments</span>
              <div className="flex gap-1">
                <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft /></Button>
                <Button size="sm" disabled={page + 1 >= payments.data.totalPages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight /></Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </>
  );
}
