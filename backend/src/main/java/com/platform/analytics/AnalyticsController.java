package com.platform.analytics;

import com.platform.analytics.dto.RestaurantOverviewResponse;
import com.platform.common.config.OpenApiConfig;
import com.platform.common.security.CurrentUserProvider;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Analytics")
@SecurityRequirement(name = OpenApiConfig.BEARER)
@RestController
@RequestMapping("/api/v1/restaurant/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final CurrentUserProvider currentUser;

    public AnalyticsController(AnalyticsService analyticsService, CurrentUserProvider currentUser) {
        this.analyticsService = analyticsService;
        this.currentUser = currentUser;
    }

    @Operation(summary = "Dashboard overview: today's KPIs, hourly and 7-day trends, top items")
    @GetMapping("/overview")
    public RestaurantOverviewResponse overview() {
        return analyticsService.restaurantOverview(currentUser.restaurantId());
    }
}
