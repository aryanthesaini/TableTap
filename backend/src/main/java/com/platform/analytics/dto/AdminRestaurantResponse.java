package com.platform.analytics.dto;

import com.platform.restaurant.dto.RestaurantResponse;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record AdminRestaurantResponse(
        RestaurantResponse restaurant,
        Stats stats,
        String paymentStatus,
        String paymentMode,
        List<Member> members
) {
    public record Stats(long ordersToday, BigDecimal revenueToday, long orders7d, BigDecimal revenue7d,
                        long ordersAllTime, BigDecimal revenueAllTime, long pendingOrders, long activeTables,
                        long menuItems, Instant lastOrderAt) {}

    public record Member(String email, String fullName, String role, Instant lastLoginAt) {}
}
