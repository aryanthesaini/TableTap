package com.platform.restaurant.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record UpdateRestaurantRequest(
        @NotBlank @Size(max = 120) String name,
        @Size(max = 500) String description,
        @Size(max = 120) String cuisine,
        @Size(max = 500) String logoUrl,
        @NotBlank @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "must be a hex colour like #C2410C") String brandColor,
        @Size(max = 255) String addressLine,
        @Size(max = 80) String city,
        @Size(max = 80) String state,
        @Size(max = 12) String postalCode,
        @Size(max = 20) String phone,
        @Email @Size(max = 160) String email,
        @NotBlank @Size(max = 20) String taxLabel,
        @NotNull @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal taxRatePercent
) {}
