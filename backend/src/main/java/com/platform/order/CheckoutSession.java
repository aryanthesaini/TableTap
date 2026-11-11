package com.platform.order;

import com.platform.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** A priced cart awaiting payment. A {@link CustomerOrder} is only created from it once payment is captured. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "checkout_session")
public class CheckoutSession extends BaseEntity {

    @Column(nullable = false, updatable = false)
    private UUID restaurantId;

    @Column(nullable = false, updatable = false)
    private UUID tableId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CheckoutStatus status = CheckoutStatus.OPEN;

    @Column(nullable = false)
    private String currency;

    @Column(nullable = false)
    private BigDecimal subtotal;

    @Column(nullable = false)
    private BigDecimal taxAmount;

    @Column(nullable = false)
    private BigDecimal totalAmount;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<CheckoutLine> items = new ArrayList<>();

    private String customerNote;
}
