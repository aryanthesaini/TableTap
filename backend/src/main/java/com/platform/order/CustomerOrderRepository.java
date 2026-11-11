package com.platform.order;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, UUID>, JpaSpecificationExecutor<CustomerOrder> {

    Optional<CustomerOrder> findByIdAndRestaurantId(UUID id, UUID restaurantId);

    Optional<CustomerOrder> findByCheckoutSessionId(UUID checkoutSessionId);

    boolean existsByCheckoutSessionId(UUID checkoutSessionId);

    long countByRestaurantIdAndStatus(UUID restaurantId, OrderStatus status);

    long countByRestaurantIdAndStatusAndCreatedAtGreaterThanEqual(UUID restaurantId, OrderStatus status, Instant from);

    long countByRestaurantIdAndCreatedAtGreaterThanEqual(UUID restaurantId, Instant from);

    /** Per-table activity: [tableId, pendingCount, ordersSince, revenueSince, lastOrderAt]. */
    @Query("""
            select o.tableId,
                   sum(case when o.status = com.platform.order.OrderStatus.PENDING then 1 else 0 end),
                   sum(case when o.createdAt >= :since then 1 else 0 end),
                   sum(case when o.createdAt >= :since then o.totalAmount else 0 end),
                   max(o.createdAt)
            from CustomerOrder o
            where o.restaurantId = :restaurantId
            group by o.tableId
            """)
    List<Object[]> tableActivity(UUID restaurantId, Instant since);
}
