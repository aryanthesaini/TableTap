"use client";
import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Banknote, Clock3, Loader2, ShieldCheck, ShoppingBag, XCircle } from "lucide-react";
import { api, ApiError, errorMessage } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { money } from "@/lib/format";
import { payWithMockGateway, type MockOutcome, type PaymentMethod } from "@/lib/payment-gateway";
import type { Checkout, CheckoutStatusResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DietaryMark } from "@/components/dashboard/status";
import { BottomSheet } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/misc";
import { MockGatewaySheet } from "@/components/storefront/mock-gateway";
import { BrandScope, InvalidQr, Stepper, StorefrontMessage } from "@/components/storefront/parts";
import { placedOrders, useStorefront } from "@/components/storefront/use-storefront";

type Phase =
  | { kind: "review" }
  | { kind: "starting" }
  | { kind: "cash-starting" }
  | { kind: "gateway"; checkout: Checkout }
  | { kind: "paying"; checkout: Checkout }
  | { kind: "verifying"; checkout: Checkout }
  | { kind: "failed"; checkout: Checkout | null; reason: string }
  | { kind: "pending"; checkout: Checkout; checking: boolean };

export default function CheckoutPage() {
  const { slug, token } = useParams<{ slug: string; token: string }>();
  const router = useRouter();
  const storefront = useStorefront(slug, token);
  const cart = useCart(token);
  const [phase, setPhase] = React.useState<Phase>({ kind: "review" });
  const [error, setError] = React.useState<string | null>(null);
  const menuHref = `/r/${slug}/t/${token}`;

  if (storefront.isLoading) return <div className="mx-auto max-w-lg space-y-3 bg-white p-5"><Skeleton className="h-8 w-1/2" /><Skeleton className="h-40" /><Skeleton className="h-32" /></div>;
  if (storefront.isError) return storefront.error instanceof ApiError && storefront.error.status === 404 ? <InvalidQr />
    : <StorefrontMessage title="Couldn't load your cart" description="Check your connection and try again." />;

  const data = storefront.data!;
  const { restaurant, table } = data;
  const currency = restaurant.currency;

  // Cross-check the cart against the live menu: items may have sold out since they were added.
  const live = new Map(data.categories.flatMap((c) => c.items).map((i) => [i.id, i]));
  const lines = cart.lines.map((l) => {
    const item = live.get(l.id);
    return { ...l, price: item ? Number(item.price) : l.price, problem: !item ? "No longer on the menu" : !item.available ? "Sold out" : null };
  });
  const problems = lines.filter((l) => l.problem);
  const subtotal = lines.filter((l) => !l.problem).reduce((s, l) => s + l.price * l.quantity, 0);
  const tax = Math.round(subtotal * Number(restaurant.taxRatePercent)) / 100;

  async function startCheckout() {
    setError(null);
    setPhase({ kind: "starting" });
    try {
      const checkout = await api<Checkout>("/public/checkout", {
        method: "POST", auth: false,
        body: { restaurantSlug: slug, tableToken: token, items: cart.lines.map((l) => ({ menuItemId: l.id, quantity: l.quantity })), note: cart.note || null },
      });
      setPhase({ kind: "gateway", checkout });
    } catch (e) {
      setPhase({ kind: "review" });
      setError(errorMessage(e, "Couldn't start payment. Please try again."));
      if (e instanceof ApiError && (e.code === "ITEM_UNAVAILABLE" || e.code === "ITEM_NOT_FOUND" || e.code === "ORDERING_UNAVAILABLE")) storefront.refetch();
    }
  }

  async function payCash() {
    setError(null);
    setPhase({ kind: "cash-starting" });
    try {
      const status = await api<CheckoutStatusResponse>("/public/checkout/pay-cash", {
        method: "POST", auth: false,
        body: { restaurantSlug: slug, tableToken: token, items: cart.lines.map((l) => ({ menuItemId: l.id, quantity: l.quantity })), note: cart.note || null },
      });
      if (status.status === "COMPLETED" && status.orderId) {
        placedOrders.add(token, status.orderId, status.orderNumber!);
        cart.clear();
        router.replace(`/r/${slug}/t/${token}/orders/${status.orderId}`);
      }
    } catch (e) {
      setPhase({ kind: "review" });
      setError(errorMessage(e, "Couldn't place order. Please try again."));
      if (e instanceof ApiError && (e.code === "ITEM_UNAVAILABLE" || e.code === "ITEM_NOT_FOUND" || e.code === "ORDERING_UNAVAILABLE")) storefront.refetch();
    }
  }

  async function pay(checkout: Checkout, outcome: MockOutcome, method: PaymentMethod) {
    setPhase({ kind: "paying", checkout });
    try {
      const result = await payWithMockGateway(checkout.payment, outcome, method);
      if (result.outcome === "SUCCESS") {
        setPhase({ kind: "verifying", checkout });
        // The server verifies the signature and checks the provider before creating the order.
        const status = await api<CheckoutStatusResponse>(`/public/checkout/${checkout.checkoutId}/confirm`, {
          method: "POST", auth: false,
          body: { providerOrderId: result.providerOrderId, providerPaymentId: result.providerPaymentId, signature: result.signature },
        });
        return finish(checkout, status);
      }
      if (result.outcome === "FAILURE") {
        const status = await api<CheckoutStatusResponse>(`/public/checkout/${checkout.checkoutId}/sync`, { method: "POST", auth: false });
        return setPhase({ kind: "failed", checkout, reason: status.failureReason ?? result.errorDescription });
      }
      await pollPending(checkout);
    } catch (e) {
      setPhase({ kind: "failed", checkout, reason: errorMessage(e, "We couldn't confirm your payment.") });
    }
  }

  async function pollPending(checkout: Checkout) {
    setPhase({ kind: "pending", checkout, checking: true });
    for (let i = 0; i < 3; i++) {
      const status = await api<CheckoutStatusResponse>(`/public/checkout/${checkout.checkoutId}/sync`, { method: "POST", auth: false });
      if (status.status !== "OPEN") return finish(checkout, status);
      await new Promise((r) => setTimeout(r, 2000));
    }
    setPhase({ kind: "pending", checkout, checking: false });
  }

  function finish(checkout: Checkout, status: CheckoutStatusResponse) {
    if (status.status === "COMPLETED" && status.orderId) {
      placedOrders.add(token, status.orderId, status.orderNumber!);
      cart.clear();
      router.replace(`/r/${slug}/t/${token}/orders/${status.orderId}`);
      return;
    }
    if (status.status === "OPEN") return setPhase({ kind: "pending", checkout, checking: false });
    setPhase({ kind: "failed", checkout, reason: status.failureReason ?? "Payment was not completed." });
  }

  if (cart.count === 0 && phase.kind === "review") {
    return (
      <BrandScope color={restaurant.brandColor}>
        <StorefrontMessage icon={ShoppingBag} title="Your cart is empty" description={`Add something delicious from ${restaurant.name}'s menu.`}
          action={<Link href={menuHref} className="inline-flex h-11 items-center rounded-xl bg-[var(--brand)] px-6 text-sm font-semibold text-white">Browse menu</Link>} />
      </BrandScope>
    );
  }

  const busy = phase.kind === "starting" || phase.kind === "cash-starting" || phase.kind === "paying" || phase.kind === "verifying";
  const gatewayCheckout = phase.kind === "gateway" || phase.kind === "paying" ? phase.checkout : null;

  return (
    <BrandScope color={restaurant.brandColor} className="min-h-dvh bg-[#f6f5f3]">
      <div className="mx-auto min-h-dvh max-w-lg pb-32">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-black/[0.06] bg-white px-3 py-3">
          <Link href={menuHref} className="rounded-full p-2 active:bg-subtle" aria-label="Back to menu"><ArrowLeft className="size-5" /></Link>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold">{restaurant.name}</h1>
            <p className="text-xs text-muted">Ordering for <span className="font-semibold text-[var(--brand)]">{table.name}</span></p>
          </div>
        </header>

        {!data.orderingEnabled && (
          <p className="mx-4 mt-4 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200">{data.orderingDisabledReason}</p>
        )}

        <section className="mx-4 mt-4 rounded-2xl bg-white p-4 shadow-xs">
          <h2 className="mb-1 text-sm font-semibold">Your order</h2>
          <ul className="divide-y divide-dashed divide-black/[0.08]">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className={cn("flex items-center gap-1.5 text-sm font-medium", l.problem && "text-muted line-through")}><DietaryMark dietary={l.dietary} /><span className="truncate">{l.name}</span></p>
                  {l.problem
                    ? <p className="mt-0.5 text-xs font-medium text-danger">{l.problem} · <button className="underline" onClick={() => cart.removeItems([l.id])}>Remove</button></p>
                    : <p className="tabular mt-0.5 text-xs text-muted">{money(l.price, currency)} each</p>}
                </div>
                {!l.problem && <Stepper size="sm" quantity={l.quantity} disabled={busy}
                  onChange={(q) => cart.setQuantity({ id: l.id, name: l.name, price: l.price, dietary: l.dietary, imageUrl: l.imageUrl }, q)} />}
                <span className="tabular w-16 text-right text-sm font-medium">{l.problem ? "—" : money(l.price * l.quantity, currency)}</span>
              </li>
            ))}
          </ul>
          <Link href={menuHref} className="mt-1 inline-block text-[13px] font-semibold text-[var(--brand)]">+ Add more items</Link>
        </section>

        <section className="mx-4 mt-3 rounded-2xl bg-white p-4 shadow-xs">
          <label htmlFor="note" className="text-sm font-semibold">Note for the kitchen</label>
          <textarea id="note" value={cart.note} onChange={(e) => cart.setNote(e.target.value.slice(0, 300))} rows={2}
            placeholder="Less spicy, no onions, allergies…"
            className="mt-2 w-full resize-none rounded-xl border border-border bg-subtle/40 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-border-strong" />
        </section>

        <section className="mx-4 mt-3 rounded-2xl bg-white p-4 shadow-xs">
          <h2 className="mb-2 text-sm font-semibold">Bill details</h2>
          <dl className="tabular space-y-1.5 text-sm">
            <div className="flex justify-between text-muted"><dt>Item total</dt><dd>{money(subtotal, currency, { decimals: true })}</dd></div>
            <div className="flex justify-between text-muted"><dt>{restaurant.taxLabel} ({Number(restaurant.taxRatePercent)}%)</dt><dd>{money(tax, currency, { decimals: true })}</dd></div>
            <div className="flex justify-between border-t border-dashed border-black/10 pt-2.5 text-base font-bold"><dt>To pay</dt><dd>{money(subtotal + tax, currency, { decimals: true })}</dd></div>
          </dl>
        </section>
        <p className="mx-6 mt-3 flex items-center gap-1.5 text-xs text-faint"><ShieldCheck className="size-3.5" /> Paid directly to {restaurant.name}. Your order goes to the kitchen as soon as payment is confirmed.</p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-lg border-t border-black/[0.06] bg-white px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        {error && <p role="alert" className="mb-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
        <button onClick={startCheckout} disabled={busy || problems.length > 0 || !data.orderingEnabled || subtotal <= 0}
          className="flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] text-base font-semibold text-white disabled:opacity-50">
          {phase.kind === "starting" ? <><Loader2 className="size-5 animate-spin" /> Preparing payment…</>
            : problems.length ? "Remove unavailable items to continue"
            : <>Pay <span className="tabular">{money(subtotal + tax, currency, { decimals: true })}</span></>}
        </button>
        <div className="relative my-2.5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-faint">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <button onClick={payCash} disabled={busy || problems.length > 0 || !data.orderingEnabled || subtotal <= 0}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-white text-sm font-medium text-fg disabled:opacity-40 active:bg-subtle">
          {phase.kind === "cash-starting" ? <><Loader2 className="size-4 animate-spin" /> Placing order…</>
            : <><Banknote className="size-4 text-muted" /> Pay at counter (Cash)</>}
        </button>
      </div>

      <MockGatewaySheet checkout={gatewayCheckout} open={!!gatewayCheckout} busy={phase.kind === "paying"}
        onClose={() => setPhase({ kind: "review" })}
        onPay={(outcome, method) => gatewayCheckout && pay(gatewayCheckout, outcome, method)} />

      <StatusSheet phase={phase} currency={currency}
        onRetry={() => { setPhase({ kind: "review" }); startCheckout(); }}
        onDismiss={() => setPhase({ kind: "review" })}
        onCheckAgain={() => phase.kind === "pending" && pollPending(phase.checkout)} />
    </BrandScope>
  );
}

function StatusSheet({ phase, currency, onRetry, onDismiss, onCheckAgain }: {
  phase: Phase; currency: string; onRetry: () => void; onDismiss: () => void; onCheckAgain: () => void;
}) {
  const open = phase.kind === "verifying" || phase.kind === "failed" || phase.kind === "pending";
  return (
    <BottomSheet open={open} onOpenChange={(o) => !o && phase.kind !== "verifying" && onDismiss()} title="Payment status">
      <div className="px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-6 text-center">
        {phase.kind === "verifying" && (
          <>
            <Loader2 className="mx-auto size-10 animate-spin text-[var(--brand)]" />
            <h2 className="mt-4 text-lg font-semibold">Confirming your payment</h2>
            <p className="mt-1 text-sm text-muted">Please don&apos;t close this page.</p>
          </>
        )}
        {phase.kind === "failed" && (
          <>
            <XCircle className="mx-auto size-11 text-danger" />
            <h2 className="mt-3 text-lg font-semibold">Payment failed</h2>
            <p className="mt-1 text-sm text-muted">{phase.reason}</p>
            <p className="mt-1 text-sm text-muted">No money was taken and no order was placed.</p>
            <button onClick={onRetry} className="mt-6 h-12 w-full rounded-xl bg-[var(--brand)] text-[15px] font-semibold text-white">Try again</button>
            <button onClick={onDismiss} className="mt-2 h-11 w-full rounded-xl text-sm font-medium text-muted">Back to cart</button>
          </>
        )}
        {phase.kind === "pending" && (
          <>
            {phase.checking ? <Loader2 className="mx-auto size-10 animate-spin text-[var(--brand)]" /> : <Clock3 className="mx-auto size-11 text-amber-600" />}
            <h2 className="mt-4 text-lg font-semibold">{phase.checking ? "Waiting for your bank…" : "Payment is taking longer than usual"}</h2>
            <p className="mt-1 text-sm text-muted">
              {phase.checking ? "This usually takes a few seconds."
                : <>If <span className="tabular font-medium text-fg">{money(phase.checkout.totalAmount, currency, { decimals: true })}</span> was debited, your order will be confirmed automatically. Otherwise it will be cancelled and nothing is charged.</>}
            </p>
            {!phase.checking && (
              <>
                <button onClick={onCheckAgain} className="mt-6 h-12 w-full rounded-xl bg-[var(--brand)] text-[15px] font-semibold text-white">Check again</button>
                <button onClick={onRetry} className="mt-2 h-11 w-full rounded-xl text-sm font-medium text-muted">Pay with another method</button>
              </>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  );
}
