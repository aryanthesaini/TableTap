package com.platform.payment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Values the provider checkout handed to the browser. They are treated as untrusted claims: the
 * backend verifies the signature and re-fetches the payment from the provider.
 */
public record ClientPaymentConfirmation(
        @NotBlank @Size(max = 64) String providerOrderId,
        @NotBlank @Size(max = 64) String providerPaymentId,
        @NotBlank @Size(max = 128) String signature
) {}
