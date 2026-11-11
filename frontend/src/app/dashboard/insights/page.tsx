"use client";
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock, Star, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { qk } from "@/lib/queries";
import type { WeeklyInsights } from "@/lib/types";
import { money } from "@/lib/format";
import { PageHeader } from "@/components/dashboard/page-header";
import { Stat } from "@/components/dashboard/stat";
import { SimpleBarChart } from "@/components/dashboard/bar-chart";
import { Card, CardHeader, EmptyState, ErrorState, Skeleton } from "@/components/ui/misc";

const DAY_SHORT = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function hourLabel(h: number) {
  const suffix = h >= 12 ? "pm" : "am";
  const n = h % 12 === 0 ? 12 : h % 12;
  return `${n}${suffix}`;
}

export default function InsightsPage() {
  const insights = useQuery({
    queryKey: qk.insights,
    queryFn: () => api<WeeklyInsights>("/restaurant/analytics/weekly"),
    refetchInterval: 60_000,
  });

  const data = insights.data;
  const currency = data?.currency ?? "INR";

  const totalRevenue = data?.last4Weeks.reduce((s, w) => s + w.revenue, 0) ?? 0;
  const totalOrders = data?.last4Weeks.reduce((s, w) => s + w.orders, 0) ?? 0;
  const peakDay = data?.dayOfWeek.reduce((best, d) => d.avgOrders > best.avgOrders ? d : best);
  const topItem = data?.topItems[0];

  const weeklyChartData = (data?.last4Weeks ?? []).map((w, i) => ({
    label: `W${i + 1}`,
    value: w.revenue,
    secondary: w.orders,
    highlight: i === 3,
  }));

  const dowChartData = (data?.dayOfWeek ?? []).map((d) => ({
    label: DAY_SHORT[d.dayOfWeek],
    value: d.avgRevenue,
    secondary: Math.round(d.avgOrders * 10) / 10,
    highlight: peakDay?.dayOfWeek === d.dayOfWeek,
  }));

  const maxAvgOrders = Math.max(0.1, ...(data?.heatmap.map((c) => c.avgOrders) ?? [0]));
  const hasData = totalOrders > 0;

  if (insights.isError) {
    return (
      <>
        <PageHeader title="Insights" description="Weekly patterns, peak hours, and top sellers." />
        <ErrorState message="Could not load insights data." onRetry={() => insights.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Insights"
        description="Based on the last 28 days of orders."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {!data ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />) : (
          <>
            <Stat label="4-week revenue" value={money(totalRevenue, currency)} hint="last 28 days, online payments" />
            <Stat label="4-week orders" value={totalOrders} hint={totalOrders > 0 ? `avg ${money(totalRevenue / totalOrders, currency)} per order` : "No orders yet"} />
            <Stat label="Busiest day" value={peakDay && peakDay.avgOrders > 0 ? DAY_FULL[peakDay.dayOfWeek] : "—"} hint={peakDay && peakDay.avgOrders > 0 ? `avg ${peakDay.avgOrders.toFixed(1)} orders/day` : "No data yet"} />
            <Stat label="Top seller" value={topItem?.name ?? "—"} hint={topItem ? `${topItem.quantity} sold in 28 days` : "No data yet"} />
          </>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title="Weekly performance" description="Revenue and order count by week" />
          <div className="px-2 pb-2 pt-3">
            {!data ? <Skeleton className="h-[220px]" /> : (
              hasData
                ? <SimpleBarChart data={weeklyChartData} currency={currency} secondaryLabel="orders" />
                : <EmptyState icon={TrendingUp} title="Not enough data" description="Insights appear after a few weeks of orders." />
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title="Day of week" description="Average revenue per day · 4-week average" />
          <div className="px-2 pb-2 pt-3">
            {!data ? <Skeleton className="h-[220px]" /> : (
              hasData
                ? <SimpleBarChart data={dowChartData} currency={currency} secondaryLabel="avg orders" />
                : <EmptyState icon={TrendingUp} title="Not enough data" description="Insights appear after a few weeks of orders." />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Busy hours"
            description="Average orders per slot by day and hour · last 28 days"
          />
          <div className="p-4">
            {!data ? <Skeleton className="h-48" /> : (
              hasData
                ? <Heatmap cells={data.heatmap} maxAvg={maxAvgOrders} />
                : <EmptyState icon={Clock} title="Not enough data" description="The heatmap fills in after a few weeks of orders." />
            )}
          </div>
          {data && hasData && data.outliers.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <p className="mb-2 text-xs font-medium text-muted">Unusual spikes</p>
              <div className="flex flex-wrap gap-2">
                {data.outliers.map((o, i) => (
                  <span key={i} className="rounded-full border border-warning/30 bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
                    {DAY_SHORT[o.dayOfWeek]} {hourLabel(o.hour)} · {o.multiplier.toFixed(1)}× avg
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="lg:col-span-2">
          <CardHeader title="Top sellers" description="Last 28 days, by quantity" />
          {!data ? <div className="p-4"><Skeleton className="h-56" /></div> : (
            hasData ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-2 pl-4 pr-2 text-left text-xs font-medium text-muted">#</th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-muted">Item</th>
                      <th className="px-2 py-2 text-right text-xs font-medium text-muted">Qty</th>
                      <th className="py-2 pl-2 pr-4 text-right text-xs font-medium text-muted">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.topItems.map((item, idx) => (
                      <tr key={item.name} className="hover:bg-subtle/50">
                        <td className="tabular py-2.5 pl-4 pr-2 text-faint">{idx + 1}</td>
                        <td className="max-w-[280px] truncate px-2 py-2.5 font-medium">{item.name}</td>
                        <td className="tabular whitespace-nowrap px-2 py-2.5 text-right text-muted">{item.quantity}</td>
                        <td className="tabular whitespace-nowrap py-2.5 pl-2 pr-4 text-right">{money(item.revenue, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <EmptyState icon={Star} title="No sales yet" description="Top sellers will appear here once orders come in." />
          )}
        </Card>

        <Card>
          <CardHeader title="Notable patterns" description="Hours that stand out from the norm" />
          <div className="space-y-3 p-4">
            {!data ? <Skeleton className="h-56" /> : data.outliers.length > 0 ? (
              data.outliers.map((o, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
                    <div>
                      <p className="text-[13px] font-semibold">{DAY_FULL[o.dayOfWeek]} at {hourLabel(o.hour)}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {o.multiplier.toFixed(1)}× busier than average · avg {o.avgOrders.toFixed(1)} orders
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState icon={AlertCircle} title="No outliers found" description="Unusual patterns will surface as more orders come in." />
            )}
          </div>
        </Card>
      </div>
    </>
  );
}

function Heatmap({ cells, maxAvg }: {
  cells: { dayOfWeek: number; hour: number; avgOrders: number }[];
  maxAvg: number;
}) {
  const byCell = new Map(cells.map((c) => [`${c.dayOfWeek}:${c.hour}`, c.avgOrders]));
  const hours = Array.from({ length: 13 }, (_, i) => i + 11);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="flex items-end">
          <div className="w-10 shrink-0" />
          {hours.map((h) => (
            <div key={h} className="flex-1 pb-1 text-center text-[10px] text-faint">
              {hourLabel(h)}
            </div>
          ))}
        </div>
        {[1, 2, 3, 4, 5, 6, 7].map((dow) => (
          <div key={dow} className="mb-0.5 flex items-center gap-0.5">
            <div className="w-10 shrink-0 pr-2 text-right text-[10px] text-faint">{DAY_SHORT[dow]}</div>
            {hours.map((h) => {
              const val = byCell.get(`${dow}:${h}`) ?? 0;
              const intensity = val / maxAvg;
              return (
                <div
                  key={h}
                  className="h-7 flex-1 rounded-sm"
                  title={`${DAY_SHORT[dow]} ${hourLabel(h)}: avg ${val.toFixed(1)} orders`}
                  style={{
                    backgroundColor: intensity < 0.05
                      ? "hsl(var(--subtle))"
                      : `hsl(var(--accent) / ${Math.min(0.92, intensity * 0.85 + 0.1)})`,
                  }}
                />
              );
            })}
          </div>
        ))}
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <span className="text-[10px] text-faint">Less</span>
          {[0.12, 0.3, 0.52, 0.72, 0.92].map((a) => (
            <div key={a} className="h-4 w-5 rounded-sm" style={{ backgroundColor: `hsl(var(--accent) / ${a})` }} />
          ))}
          <span className="text-[10px] text-faint">More</span>
        </div>
      </div>
    </div>
  );
}
