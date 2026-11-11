package com.platform.common.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

/**
 * Strongly-typed application configuration ({@code app.*} in application.yml).
 */
@Validated
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @NotBlank String publicBaseUrl,
        @NotBlank String timezone,
        @NotNull Security security,
        @NotNull Payments payments,
        @NotNull Storage storage,
        @NotNull MenuAi menuAi,
        @NotNull Demo demo
) {
    public record Security(@NotBlank String jwtSecret, @NotNull Duration jwtTtl) {}

    public record Payments(@NotBlank String provider, @NotNull Duration pendingTimeout, @NotNull Duration mockWebhookDelay) {}

    public record Storage(@NotBlank String provider, @NotBlank String localRoot, @NotBlank String publicPath) {}

    public record MenuAi(@NotBlank String provider, @NotNull Duration mockProcessingDelay) {}

    public record Demo(boolean enabled) {}
}
