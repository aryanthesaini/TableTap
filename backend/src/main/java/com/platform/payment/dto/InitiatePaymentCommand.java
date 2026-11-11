package com.platform.payment.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record InitiatePaymentCommand(UUID restaurantId, UUID checkoutSessionId, BigDecimal amount, String currency) {}
