"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { money, moneyCompact } from "@/lib/format";

export interface BarDatum { label: string; value: number; secondary?: number; highlight?: boolean }

/** Single-series bar chart: one neutral colour, the current period highlighted in the accent. */
export function SimpleBarChart({ data, currency, height = 220, secondaryLabel = "orders" }: {
  data: BarDatum[]; currency: string; height?: number; secondaryLabel?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="0" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--faint))" }} interval="preserveStartEnd" />
        <YAxis tickLine={false} axisLine={false} width={52} tick={{ fontSize: 11, fill: "hsl(var(--faint))" }}
          tickFormatter={(v) => currency === "INR" ? moneyCompact(v) : money(v, currency, { compact: true })} />
        <Tooltip
          cursor={{ fill: "hsl(var(--subtle))" }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as BarDatum;
            return (
              <div className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-pop">
                <p className="font-medium">{label}</p>
                <p className="tabular text-muted">{money(d.value, currency)}{d.secondary !== undefined && ` · ${d.secondary} ${secondaryLabel}`}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={36}
          shape={(props: unknown) => {
            const p = props as { x: number; y: number; width: number; height: number; payload: BarDatum };
            return <rect x={p.x} y={p.y} width={p.width} height={Math.max(p.height, 0)} rx={3}
              fill={p.payload.highlight ? "hsl(var(--accent))" : "hsl(24 8% 72%)"} />;
          }} />
      </BarChart>
    </ResponsiveContainer>
  );
}
