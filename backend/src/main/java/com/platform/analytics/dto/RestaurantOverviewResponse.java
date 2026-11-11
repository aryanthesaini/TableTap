package com.platform.analytics.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record RestaurantOverviewResponse(
        String currency,
        Today today,
        List<HourlyPoint> hourly,
        List<DailyPoint> last7Days,
        List<TopItem> topItems
) {
    /** Today's numbers plus the same time window yesterday, for deltas. */
    public record Today(long orders, BigDecimal revenue, long pendingOrders, long servedOrders, BigDecimal averageOrderValue,
                        long ordersYesterdaySameTime, BigDecimal revenueYesterdaySameTime) {}

    public record HourlyPoint(int hour, long orders, BigDecimal revenue) {}

    public record DailyPoint(LocalDate date, long orders, BigDecimal revenue) {}

    public record TopItem(String name, long quantity, BigDecimal revenue) {}
}
