package com.platform.analytics.dto;

import java.math.BigDecimal;
import java.util.List;

public record PlatformOverviewResponse(
        long restaurants,
        long activeRestaurants,
        long suspendedRestaurants,
        long ordersToday,
        BigDecimal gmvToday,
        long orders7d,
        BigDecimal gmv7d,
        List<RestaurantDailyPoint> last7Days
) {
    public record RestaurantDailyPoint(java.time.LocalDate date, long orders, BigDecimal gmv) {}
}
