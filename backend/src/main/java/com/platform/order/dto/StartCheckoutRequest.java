package com.platform.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

/** The customer's cart. Only ids and quantities are accepted — prices always come from the server. */
public record StartCheckoutRequest(
        @NotBlank @Size(max = 80) String restaurantSlug,
        @NotBlank @Size(max = 32) String tableToken,
        @NotEmpty(message = "Your cart is empty") @Size(max = 50) List<@Valid CartLine> items,
        @Size(max = 300) String note
) {
    public record CartLine(@NotNull UUID menuItemId, @Min(1) @Max(20) int quantity) {}
}
