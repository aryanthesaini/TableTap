import { api } from "./api";
import type { PaymentInitiation } from "./types";

/**
 * What a provider checkout hands back to the browser. This is forwarded to the backend for
 * verification and is never treated as proof of payment on the client.
 *
 * Real Razorpay: load https://checkout.razorpay.com/v1/checkout.js and call
 * `new Razorpay({ key: init.keyId, order_id: init.providerOrderId, handler })` — its handler receives
 * exactly these three fields (razorpay_order_id / razorpay_payment_id / razorpay_signature).
 */
export type GatewayResult =
  | { outcome: "SUCCESS"; providerOrderId: string; providerPaymentId: string; signature: string }
  | { outcome: "FAILURE"; providerOrderId: string; errorDescription: string }
  | { outcome: "TIMEOUT"; providerOrderId: string };

export type MockOutcome = "SUCCESS" | "FAILURE" | "TIMEOUT";
export type PaymentMethod = "UPI" | "CARD" | "NETBANKING";

/** Mock provider only: simulates the customer finishing payment inside the hosted checkout. */
export async function payWithMockGateway(init: PaymentInitiation, outcome: MockOutcome, method: PaymentMethod): Promise<GatewayResult> {
  const res = await api<{ outcome: MockOutcome; providerOrderId: string; providerPaymentId: string; signature: string | null; errorDescription: string | null }>(
    `/public/mock-gateway/orders/${init.providerOrderId}/pay`, { method: "POST", body: { outcome, method }, auth: false });
  if (res.outcome === "SUCCESS") return { outcome: "SUCCESS", providerOrderId: res.providerOrderId, providerPaymentId: res.providerPaymentId, signature: res.signature! };
  if (res.outcome === "FAILURE") return { outcome: "FAILURE", providerOrderId: res.providerOrderId, errorDescription: res.errorDescription ?? "Payment failed" };
  // A real timeout means the browser never hears back; the mock waits a moment to feel the same.
  await new Promise((r) => setTimeout(r, 1500));
  return { outcome: "TIMEOUT", providerOrderId: res.providerOrderId };
}
