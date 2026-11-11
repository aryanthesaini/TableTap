package com.platform.payment.provider;

public record ProviderWebhookEvent(String eventId, String eventType, String providerOrderId, String providerPaymentId) {}
