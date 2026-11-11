package com.platform.menu.dto;

import com.platform.menu.Dietary;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record MenuItemResponse(
        UUID id,
        UUID categoryId,
        String name,
        String description,
        BigDecimal price,
        String imageUrl,
        boolean available,
        Dietary dietary,
        boolean featured,
        int sortOrder,
        Instant updatedAt
) {}
