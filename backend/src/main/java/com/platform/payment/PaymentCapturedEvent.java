package com.platform.payment;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Published (synchronously, inside the capturing transaction) exactly once when a payment
 * transitions to CAPTURED. The order module listens and creates the order.
 */
public record PaymentCapturedEvent(UUID paymentId, UUID restaurantId, UUID checkoutSessionId, BigDecimal amount, String method) {}
