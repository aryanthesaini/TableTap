package com.platform.order.dto;

import com.platform.order.OrderStatus;
import com.platform.payment.PaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Order as shown to the customer on the confirmation / tracking page. */
public record CustomerOrderResponse(
        UUID id,
        int orderNumber,
        OrderStatus status,
        PaymentStatus paymentStatus,
        String restaurantName,
        String restaurantSlug,
        String brandColor,
        String tableName,
        String currency,
        List<OrderItemResponse> items,
        BigDecimal subtotal,
        String taxLabel,
        BigDecimal taxAmount,
        BigDecimal totalAmount,
        Instant createdAt,
        Instant servedAt
) {}
