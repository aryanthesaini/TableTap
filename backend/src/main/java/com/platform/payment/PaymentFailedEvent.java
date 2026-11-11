package com.platform.payment;

import java.util.UUID;

public record PaymentFailedEvent(UUID paymentId, UUID restaurantId, UUID checkoutSessionId, String reason) {}
