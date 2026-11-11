package com.platform.order;

import java.math.BigDecimal;
import java.util.UUID;

/** One priced line of a checkout session, stored as JSON. Prices are computed server-side. */
public record CheckoutLine(UUID menuItemId, String name, BigDecimal unitPrice, int quantity, BigDecimal lineTotal,
                           String dietary) {}
