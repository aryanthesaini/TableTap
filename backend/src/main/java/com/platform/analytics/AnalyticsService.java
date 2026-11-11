package com.platform.analytics;

import com.platform.analytics.dto.AdminRestaurantResponse;
import com.platform.analytics.dto.PlatformOverviewResponse;
import com.platform.analytics.dto.RestaurantOverviewResponse;

import java.util.List;
import java.util.UUID;

/** Read-only reporting. Queries the operational tables directly (no writes, no domain logic). */
public interface AnalyticsService {

    RestaurantOverviewResponse restaurantOverview(UUID restaurantId);

    PlatformOverviewResponse platformOverview();

    List<AdminRestaurantResponse> adminRestaurants();

    AdminRestaurantResponse adminRestaurant(UUID restaurantId);
}
