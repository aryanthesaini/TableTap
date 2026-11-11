package com.platform.order.dto;

import com.platform.order.OrderStatus;
import com.platform.payment.PaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record OrderResponse(
        UUID id,
        int orderNumber,
        UUID tableId,
        String tableName,
        OrderStatus status,
        PaymentStatus paymentStatus,
        String currency,
        BigDecimal subtotal,
        BigDecimal taxAmount,
        BigDecimal totalAmount,
        String customerNote,
        int itemCount,
        List<OrderItemResponse> items,
        Instant createdAt,
        Instant servedAt
) {}
