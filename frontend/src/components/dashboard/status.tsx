import { Badge } from "@/components/ui/badge";
import type { Dietary, OrderStatus, PaymentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return status === "PENDING"
    ? <Badge tone="warning" dot>Pending</Badge>
    : <Badge tone="success" dot>Served</Badge>;
}

const PAYMENT_TONE: Record<PaymentStatus, "success" | "warning" | "danger" | "neutral" | "info"> = {
  CAPTURED: "success", PENDING: "warning", CREATED: "neutral", FAILED: "danger", REFUNDED: "info",
};
const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  CAPTURED: "Paid", PENDING: "Pending", CREATED: "Initiated", FAILED: "Failed", REFUNDED: "Refunded",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_TONE[status]}>{PAYMENT_LABEL[status]}</Badge>;
}

/** Indian food-labelling convention: green square/dot = veg, red/brown triangle = non-veg, yellow = egg. */
export function DietaryMark({ dietary, className }: { dietary: Dietary | null | undefined; className?: string }) {
  if (!dietary) return null;
  const color = dietary === "VEG" ? "#15803d" : dietary === "EGG" ? "#ca8a04" : "#b91c1c";
  const label = dietary === "VEG" ? "Vegetarian" : dietary === "EGG" ? "Contains egg" : "Non-vegetarian";
  return (
    <span title={label} aria-label={label} role="img"
      className={cn("inline-flex size-[14px] shrink-0 items-center justify-center rounded-[3px] border-[1.5px] bg-white", className)}
      style={{ borderColor: color }}>
      {dietary === "NON_VEG" ? (
        <svg viewBox="0 0 10 10" className="size-[7px]"><path d="M5 1 9.2 9H.8z" fill={color} /></svg>
      ) : (
        <span className="size-[6px] rounded-full" style={{ background: color }} />
      )}
    </span>
  );
}
