package com.platform.restaurant.dto;

import com.platform.restaurant.RestaurantStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateRestaurantStatusRequest(@NotNull RestaurantStatus status) {}
