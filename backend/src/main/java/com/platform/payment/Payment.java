package com.platform.payment;

import com.platform.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "payment")
public class Payment extends BaseEntity {

    @Column(nullable = false, updatable = false)
    private UUID restaurantId;

    /** The priced cart this payment is for (owned by the order module; referenced by id only). */
    @Column(nullable = false, updatable = false)
    private UUID checkoutSessionId;

    private UUID orderId;

    private Integer orderNumber;

    @Column(nullable = false, updatable = false)
    private String provider;

    @Column(nullable = false, updatable = false)
    private String providerOrderId;

    private String providerPaymentId;

    @Column(nullable = false, updatable = false)
    private BigDecimal amount;

    @Column(nullable = false, updatable = false)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus status = PaymentStatus.CREATED;

    private String method;

    private String failureReason;

    private Instant capturedAt;
}
