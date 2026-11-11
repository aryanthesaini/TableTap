package com.platform.restaurant.dto;

import com.platform.restaurant.RestaurantStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Restaurant details. Also used as the read-only view other modules receive, so they never
 * depend on the {@code Restaurant} entity.
 */
public record RestaurantResponse(
        UUID id,
        String slug,
        String name,
        String description,
        String cuisine,
        String logoUrl,
        String coverImageUrl,
        String brandColor,
        String addressLine,
        String city,
        String state,
        String postalCode,
        String phone,
        String email,
        RestaurantStatus status,
        boolean acceptingOrders,
        String currency,
        String taxLabel,
        BigDecimal taxRatePercent,
        Instant createdAt
) {
    public boolean canAcceptOrders() {
        return status == RestaurantStatus.ACTIVE && acceptingOrders;
    }
}
