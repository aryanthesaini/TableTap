package com.platform.order.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record OrderItemResponse(UUID menuItemId, String name, BigDecimal unitPrice, int quantity,
                                BigDecimal lineTotal, String dietary) {}
