package com.platform.order;

import java.math.BigDecimal;
import java.util.UUID;

/** Published when a paid order is created. Consumed after commit (e.g. notifications). */
public record OrderPlacedEvent(UUID orderId, UUID restaurantId, int orderNumber, String tableName,
                               BigDecimal totalAmount, String currency, int itemCount) {}
