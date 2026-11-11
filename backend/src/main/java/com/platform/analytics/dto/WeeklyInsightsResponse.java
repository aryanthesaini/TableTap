package com.platform.analytics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record WeeklyInsightsResponse(
        String currency,
        List<WeekSummary> last4Weeks,
        List<DayPattern> dayOfWeek,
        List<HeatmapCell> heatmap,
        List<TopItem> topItems,
        List<Outlier> outliers
) {
    /** One calendar week (Mon–Sun) with aggregate stats. */
    public record WeekSummary(
            LocalDate weekStart,
            LocalDate weekEnd,
            long orders,
            BigDecimal revenue,
            BigDecimal averageOrderValue
    ) {}

    /** Average performance for a day of week across 4 weeks. dayOfWeek: 1=Mon … 7=Sun. */
    public record DayPattern(
            int dayOfWeek,
            String dayName,
            double avgOrders,
            double avgRevenue
    ) {}

    /** One cell of the day × hour heatmap. avgOrders is averaged over 4 occurrences of that day. */
    public record HeatmapCell(
            int dayOfWeek,
            int hour,
            double avgOrders
    ) {}

    public record TopItem(
            String name,
            long quantity,
            BigDecimal revenue
    ) {}

    /** A day+hour slot that is notably busier than the same hour averaged across all 7 days. */
    public record Outlier(
            int dayOfWeek,
            String dayName,
            int hour,
            double avgOrders,
            double hourAvgAcrossDays,
            double multiplier
    ) {}
}
