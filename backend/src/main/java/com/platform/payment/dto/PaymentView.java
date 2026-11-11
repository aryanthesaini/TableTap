package com.platform.payment.dto;

import com.platform.payment.PaymentStatus;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PaymentView(
        UUID id,
        UUID checkoutSessionId,
        UUID orderId,
        Integer orderNumber,
        String provider,
        String providerOrderId,
        String providerPaymentId,
        BigDecimal amount,
        String currency,
        PaymentStatus status,
        String method,
        String failureReason,
        Instant createdAt,
        Instant capturedAt
) {}
