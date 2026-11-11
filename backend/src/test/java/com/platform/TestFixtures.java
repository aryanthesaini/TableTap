package com.platform;

import com.platform.restaurant.RestaurantStatus;
import com.platform.restaurant.dto.RestaurantResponse;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public final class TestFixtures {

    private TestFixtures() {}

    public static RestaurantResponse restaurant(UUID id, String slug) {
        return restaurant(id, slug, RestaurantStatus.ACTIVE, true);
    }

    public static RestaurantResponse restaurant(UUID id, String slug, RestaurantStatus status, boolean accepting) {
        return new RestaurantResponse(id, slug, "Test Kitchen", null, null, null, null, "#C2410C", null, null, null,
                null, null, null, status, accepting, "INR", "GST", new BigDecimal("5.00"), Instant.now());
    }
}
