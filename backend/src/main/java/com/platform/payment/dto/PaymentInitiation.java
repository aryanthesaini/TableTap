package com.platform.payment.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Everything the browser needs to open the provider's checkout. Contains only the public key id —
 * never secrets.
 */
public record PaymentInitiation(UUID paymentId, String provider, String keyId, String providerOrderId,
                                BigDecimal amount, long amountMinor, String currency) {}
