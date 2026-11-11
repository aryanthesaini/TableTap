package com.platform.payment.dto;

import java.time.Instant;

/** Secrets are never returned — only whether they are set. */
public record PaymentConfigurationResponse(
        String provider,
        String mode,
        String status,
        String keyId,
        boolean keySecretSet,
        boolean webhookSecretSet,
        String webhookUrl,
        Instant connectedAt
) {}
