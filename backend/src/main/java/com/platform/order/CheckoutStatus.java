package com.platform.order;

public enum CheckoutStatus {
    /** Awaiting payment. */
    OPEN,
    /** Payment captured and order created. */
    COMPLETED,
    FAILED,
    EXPIRED
}
