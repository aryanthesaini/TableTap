package com.platform.table.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * @param orderingUrl the URL encoded in the table's QR code ({publicBaseUrl}/r/{slug}/t/{qrToken})
 */
public record TableResponse(
        UUID id,
        String name,
        Integer seats,
        boolean active,
        String qrToken,
        String orderingUrl,
        Instant qrGeneratedAt,
        int sortOrder,
        Instant createdAt
) {}
