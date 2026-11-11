package com.platform.order;

import com.platform.common.persistence.BaseEntity;
import com.platform.payment.PaymentStatus;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "customer_order")
public class CustomerOrder extends BaseEntity {

    @Column(nullable = false, updatable = false)
    private UUID restaurantId;

    @Column(nullable = false, updatable = false)
    private UUID tableId;

    /** Snapshot of the table name at order time. */
    @Column(nullable = false, updatable = false)
    private String tableName;

    @Column(nullable = false, updatable = false)
    private int orderNumber;

    @Column(updatable = false)
    private UUID checkoutSessionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.PENDING;

    /** Kept independent of {@link #status}: food status and money status evolve separately. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PaymentStatus paymentStatus;

    @Column(nullable = false)
    private String currency;

    @Column(nullable = false)
    private BigDecimal subtotal;

    @Column(nullable = false)
    private BigDecimal taxAmount;

    @Column(nullable = false)
    private BigDecimal totalAmount;

    private String customerNote;
    private Instant servedAt;
    private UUID servedBy;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("itemName asc")
    private List<OrderItem> items = new ArrayList<>();

    public void addItem(OrderItem item) {
        item.setOrder(this);
        items.add(item);
    }
}
