package com.platform.order.dto;

import com.platform.order.CheckoutStatus;
import com.platform.payment.PaymentStatus;

import java.util.UUID;

public record CheckoutStatusResponse(
        UUID checkoutId,
        CheckoutStatus status,
        PaymentStatus paymentStatus,
        String failureReason,
        UUID orderId,
        Integer orderNumber
) {}
