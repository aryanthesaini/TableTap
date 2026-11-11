package com.platform.payment.dto;

import java.math.BigDecimal;

public record PaymentSummary(int days, long capturedCount, BigDecimal capturedAmount, long failedCount,
                             long pendingCount, double successRate) {}
