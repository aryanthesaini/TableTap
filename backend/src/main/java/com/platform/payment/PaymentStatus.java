package com.platform.payment;

public enum PaymentStatus {
    /** Payment intent created with the provider; customer has not paid yet. */
    CREATED,
    /** Customer attempted payment; awaiting a final result from the provider. */
    PENDING,
    CAPTURED,
    FAILED,
    REFUNDED,
    /** Customer chose to pay at the counter with cash — no gateway involved. */
    CASH;

    public boolean isFinal() {
        return this == CAPTURED || this == FAILED || this == REFUNDED || this == CASH;
    }
}
