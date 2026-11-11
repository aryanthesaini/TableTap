package com.platform.analytics;

import com.platform.analytics.dto.AdminRestaurantResponse;
import com.platform.analytics.dto.PlatformOverviewResponse;
import com.platform.common.config.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Tag(name = "Platform admin")
@SecurityRequirement(name = OpenApiConfig.BEARER)
@RestController
@RequestMapping("/api/v1/admin")
public class PlatformAdminController {

    private final AnalyticsService analyticsService;

    public PlatformAdminController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @Operation(summary = "Platform-wide statistics")
    @GetMapping("/overview")
    public PlatformOverviewResponse overview() {
        return analyticsService.platformOverview();
    }

    @Operation(summary = "All restaurants with key stats")
    @GetMapping("/restaurants")
    public List<AdminRestaurantResponse> restaurants() {
        return analyticsService.adminRestaurants();
    }

    @Operation(summary = "Restaurant details, stats and team members")
    @GetMapping("/restaurants/{restaurantId}")
    public AdminRestaurantResponse restaurant(@PathVariable UUID restaurantId) {
        return analyticsService.adminRestaurant(restaurantId);
    }
}
