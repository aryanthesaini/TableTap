package com.platform.order.dto;

import com.platform.order.OrderStatus;

import java.time.Instant;
import java.util.UUID;

/** Restaurant order search criteria; all fields optional. {@code query} matches order number or item name. */
public record OrderFilter(OrderStatus status, UUID tableId, String query, Instant from, Instant to) {}
