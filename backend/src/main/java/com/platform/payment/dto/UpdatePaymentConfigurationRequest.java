package com.platform.payment.dto;

import com.platform.payment.PaymentConfiguration;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Blank secrets keep the currently stored value. */
public record UpdatePaymentConfigurationRequest(
        @NotNull PaymentConfiguration.Mode mode,
        @NotBlank @Size(max = 80) String keyId,
        @Size(max = 200) String keySecret,
        @Size(max = 200) String webhookSecret
) {}
