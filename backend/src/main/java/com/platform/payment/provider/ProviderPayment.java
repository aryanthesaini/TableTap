package com.platform.payment.provider;

/** Authoritative payment state as reported by the provider's server API. */
public record ProviderPayment(String providerPaymentId, String providerOrderId, ProviderPaymentStatus status,
                              long amountMinor, String method, String errorDescription) {}
