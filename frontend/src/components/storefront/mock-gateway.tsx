"use client";
import * as React from "react";
import { Building2, CreditCard, FlaskConical, Lock, Smartphone } from "lucide-react";
import type { Checkout } from "@/lib/types";
import type { MockOutcome, PaymentMethod } from "@/lib/payment-gateway";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BottomSheet } from "@/components/ui/dialog";

const METHODS: { id: PaymentMethod; label: string; hint: string; icon: React.ElementType }[] = [
  { id: "UPI", label: "UPI", hint: "GPay, PhonePe, Paytm & more", icon: Smartphone },
  { id: "CARD", label: "Card", hint: "Credit or debit card", icon: CreditCard },
  { id: "NETBANKING", label: "Netbanking", hint: "All major banks", icon: Building2 },
];

/**
 * Stand-in for the payment provider's hosted checkout (test mode). In production this sheet is
 * replaced by the provider's own UI; the rest of the flow is unchanged.
 */
export function MockGatewaySheet({ checkout, open, busy, onClose, onPay }: {
  checkout: Checkout | null; open: boolean; busy: boolean; onClose: () => void;
  onPay: (outcome: MockOutcome, method: PaymentMethod) => void;
}) {
  const [method, setMethod] = React.useState<PaymentMethod>("UPI");
  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && !busy && onClose()} title="Payment">
      {checkout && (
        <div className="overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted">Paying {checkout.restaurantName}</p>
              <p className="tabular text-2xl font-bold tracking-tight">{money(checkout.totalAmount, checkout.currency, { decimals: true })}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
              <FlaskConical className="size-3" /> Test mode
            </span>
          </div>

          <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-faint">Pay using</p>
          <div className="space-y-2">
            {METHODS.map((m) => (
              <button key={m.id} type="button" onClick={() => setMethod(m.id)} aria-pressed={method === m.id}
                className={cn("flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                  method === m.id ? "border-fg bg-subtle/60" : "border-border")}>
                <m.icon className="size-5 text-muted" />
                <span className="flex-1"><span className="block text-sm font-semibold">{m.label}</span><span className="block text-xs text-muted">{m.hint}</span></span>
                <span className={cn("size-4 rounded-full border-2", method === m.id ? "border-[5px] border-fg" : "border-border-strong")} />
              </button>
            ))}
          </div>

          <button disabled={busy} onClick={() => onPay("SUCCESS", method)}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] text-[15px] font-semibold text-white disabled:opacity-60">
            {busy ? "Processing…" : <>Pay <span className="tabular">{money(checkout.totalAmount, checkout.currency, { decimals: true })}</span></>}
          </button>

          <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-3">
            <p className="text-xs font-medium text-amber-900">Simulate another outcome</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button disabled={busy} onClick={() => onPay("FAILURE", method)} className="h-9 rounded-lg border border-amber-300 bg-white text-[13px] font-medium text-amber-900 disabled:opacity-50">Payment fails</button>
              <button disabled={busy} onClick={() => onPay("TIMEOUT", method)} className="h-9 rounded-lg border border-amber-300 bg-white text-[13px] font-medium text-amber-900 disabled:opacity-50">Bank times out</button>
            </div>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1 text-[11px] text-faint"><Lock className="size-3" /> Simulated gateway · no real money moves</p>
        </div>
      )}
    </BottomSheet>
  );
}
