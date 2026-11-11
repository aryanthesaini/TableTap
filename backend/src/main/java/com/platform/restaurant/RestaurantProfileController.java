package com.platform.restaurant;

import com.platform.common.config.OpenApiConfig;
import com.platform.common.security.CurrentUserProvider;
import com.platform.restaurant.dto.RestaurantResponse;
import com.platform.restaurant.dto.UpdateOperatingStatusRequest;
import com.platform.restaurant.dto.UpdateRestaurantRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Restaurant profile")
@SecurityRequirement(name = OpenApiConfig.BEARER)
@RestController
@RequestMapping("/api/v1/restaurant/profile")
public class RestaurantProfileController {

    private final RestaurantService restaurantService;
    private final CurrentUserProvider currentUser;

    public RestaurantProfileController(RestaurantService restaurantService, CurrentUserProvider currentUser) {
        this.restaurantService = restaurantService;
        this.currentUser = currentUser;
    }

    @Operation(summary = "Get the signed-in user's restaurant")
    @GetMapping
    public RestaurantResponse get() {
        return restaurantService.get(currentUser.restaurantId());
    }

    @Operation(summary = "Update restaurant details (owner only)")
    @PreAuthorize("hasRole('OWNER')")
    @PutMapping
    public RestaurantResponse update(@Valid @RequestBody UpdateRestaurantRequest request) {
        return restaurantService.update(currentUser.restaurantId(), request);
    }

    @Operation(summary = "Open or pause online ordering (owner only)")
    @PreAuthorize("hasRole('OWNER')")
    @PatchMapping("/operating-status")
    public RestaurantResponse setOperatingStatus(@Valid @RequestBody UpdateOperatingStatusRequest request) {
        return restaurantService.setAcceptingOrders(currentUser.restaurantId(), request.acceptingOrders());
    }
}
