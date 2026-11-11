package com.platform.payment.provider;

public enum ProviderPaymentStatus {
    /** No payment attempt yet for the order. */
    NONE,
    /** Attempt in progress (bank/UPI confirmation pending). */
    PROCESSING,
    AUTHORIZED,
    CAPTURED,
    FAILED,
    REFUNDED
}
