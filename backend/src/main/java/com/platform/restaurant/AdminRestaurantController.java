package com.platform.restaurant;

import com.platform.common.config.OpenApiConfig;
import com.platform.restaurant.dto.RestaurantResponse;
import com.platform.restaurant.dto.UpdateRestaurantStatusRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Tag(name = "Platform admin")
@SecurityRequirement(name = OpenApiConfig.BEARER)
@RestController
@RequestMapping("/api/v1/admin/restaurants")
public class AdminRestaurantController {

    private final RestaurantService restaurantService;

    public AdminRestaurantController(RestaurantService restaurantService) {
        this.restaurantService = restaurantService;
    }

    @Operation(summary = "Activate or suspend a restaurant")
    @PatchMapping("/{restaurantId}/status")
    public RestaurantResponse updateStatus(@PathVariable UUID restaurantId,
                                           @Valid @RequestBody UpdateRestaurantStatusRequest request) {
        return restaurantService.setStatus(restaurantId, request.status());
    }
}
