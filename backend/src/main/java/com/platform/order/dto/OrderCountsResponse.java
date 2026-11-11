package com.platform.order.dto;

public record OrderCountsResponse(long pending, long servedToday, long ordersToday) {}
