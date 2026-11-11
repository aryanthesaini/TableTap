import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Stat({ label, value, delta, hint, className, emphasis }: {
  label: string; value: React.ReactNode; delta?: { current: number; previous: number; minBase?: number } | null; hint?: React.ReactNode;
  className?: string; emphasis?: boolean;
}) {
  let deltaEl: React.ReactNode = null;
  if (delta && delta.previous > 0 && (delta.minBase === undefined || delta.minBase >= 3)) {
    const pct = Math.round(((delta.current - delta.previous) / delta.previous) * 100);
    const up = pct >= 0;
    deltaEl = (
      <span className={cn("tabular inline-flex items-center text-xs font-medium", up ? "text-success" : "text-danger")}>
        {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{Math.abs(pct)}%
      </span>
    );
  }
  return (
    <div className={cn("min-w-0 rounded-lg border border-border bg-surface px-3.5 py-3 shadow-xs sm:px-4 sm:py-3.5", emphasis && "border-warning/40 bg-warning-soft/40", className)}>
      <p className="truncate text-[13px] text-muted">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span className="tabular truncate text-[19px] font-semibold tracking-tight sm:text-[22px]">{value}</span>
        {deltaEl}
      </div>
      {hint && <p className="mt-0.5 truncate text-xs text-faint">{hint}</p>}
    </div>
  );
}
