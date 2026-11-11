package com.platform.payment.provider;

/** A provider-side order (Razorpay "order") that the customer pays against. */
public record ProviderOrder(String providerOrderId, long amountMinor, String currency) {}
