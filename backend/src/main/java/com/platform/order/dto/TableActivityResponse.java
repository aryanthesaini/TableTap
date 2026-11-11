package com.platform.order.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TableActivityResponse(UUID tableId, long pendingOrders, long ordersToday, BigDecimal revenueToday,
                                    Instant lastOrderAt) {}
