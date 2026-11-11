package com.platform.order.dto;

import com.platform.menu.Dietary;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Everything the customer menu page needs after scanning a table QR code. */
public record StorefrontResponse(
        Restaurant restaurant,
        Table table,
        boolean orderingEnabled,
        String orderingDisabledReason,
        List<Category> categories
) {
    public record Restaurant(String slug, String name, String description, String cuisine, String logoUrl,
                             String coverImageUrl, String brandColor, String addressLine, String city,
                             String currency, String taxLabel, BigDecimal taxRatePercent) {}

    public record Table(String name, String token) {}

    public record Category(UUID id, String name, String description, List<Item> items) {}

    public record Item(UUID id, String name, String description, BigDecimal price, String imageUrl,
                       boolean available, Dietary dietary, boolean featured) {}
}
