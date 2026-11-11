package com.platform.order.dto;

import com.platform.order.CheckoutLine;
import com.platform.order.CheckoutStatus;
import com.platform.payment.dto.PaymentInitiation;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CheckoutResponse(
        UUID checkoutId,
        CheckoutStatus status,
        String restaurantName,
        String tableName,
        String currency,
        List<CheckoutLine> items,
        BigDecimal subtotal,
        String taxLabel,
        BigDecimal taxRatePercent,
        BigDecimal taxAmount,
        BigDecimal totalAmount,
        PaymentInitiation payment
) {}
