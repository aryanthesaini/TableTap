"use client";
import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Minus, Plus, QrCode } from "lucide-react";
import { cn } from "@/lib/utils";

/** Applies the restaurant's brand colour to everything inside. */
export function BrandScope({ color, children, className }: { color: string; children: React.ReactNode; className?: string }) {
  return <div className={className} style={{ ["--brand" as string]: color }}>{children}</div>;
}

export function Stepper({ quantity, onChange, size = "md", disabled }: { quantity: number; onChange: (q: number) => void; size?: "sm" | "md"; disabled?: boolean }) {
  return (
    <div className={cn("inline-flex items-center rounded-lg border border-[var(--brand)] bg-white text-[var(--brand)] shadow-xs",
      size === "sm" ? "h-8" : "h-9")}>
      <button type="button" disabled={disabled} onClick={() => onChange(quantity - 1)} aria-label="Decrease quantity"
        className={cn("flex h-full items-center justify-center rounded-l-lg active:bg-black/5 disabled:opacity-40", size === "sm" ? "w-8" : "w-9")}>
        <Minus className="size-4" strokeWidth={2.5} />
      </button>
      <span className="tabular min-w-[20px] text-center text-sm font-semibold" aria-live="polite">{quantity}</span>
      <button type="button" disabled={disabled || quantity >= 20} onClick={() => onChange(quantity + 1)} aria-label="Increase quantity"
        className={cn("flex h-full items-center justify-center rounded-r-lg active:bg-black/5 disabled:opacity-40", size === "sm" ? "w-8" : "w-9")}>
        <Plus className="size-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function AddButton({ onClick, disabled, className }: { onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={cn("h-9 w-[84px] rounded-lg border border-black/10 bg-white text-[13px] font-bold uppercase tracking-wide text-[var(--brand)] shadow-[0_2px_8px_-2px_rgb(0_0_0/0.18)] active:scale-[0.97] disabled:opacity-40", className)}>
      Add
    </button>
  );
}

export function StorefrontMessage({ title, description, icon: Icon = AlertTriangle, action }: {
  title: string; description: React.ReactNode; icon?: React.ElementType; action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-8 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-subtle text-muted"><Icon className="size-6" /></div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-1.5 max-w-xs text-sm text-muted">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function InvalidQr() {
  return <StorefrontMessage icon={QrCode} title="This QR code isn't working" description="It may be old or damaged. Please ask a staff member for help, or scan the code on your table again." />;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-sm font-semibold text-[var(--brand)]">{children}</Link>;
}
