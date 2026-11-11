package com.platform.restaurant.dto;

import jakarta.validation.constraints.NotNull;

public record UpdateOperatingStatusRequest(@NotNull Boolean acceptingOrders) {}
