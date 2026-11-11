package com.platform.payment;

import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Payment p where p.id = :id")
    Optional<Payment> findByIdForUpdate(UUID id);

    Optional<Payment> findByProviderAndProviderOrderId(String provider, String providerOrderId);

    Optional<Payment> findByIdAndRestaurantId(UUID id, UUID restaurantId);

    Optional<Payment> findFirstByCheckoutSessionIdOrderByCreatedAtDesc(UUID checkoutSessionId);

    Page<Payment> findAllByRestaurantId(UUID restaurantId, Pageable pageable);

    Page<Payment> findAllByRestaurantIdAndStatus(UUID restaurantId, PaymentStatus status, Pageable pageable);

    @Query("select p.id from Payment p where p.status in :statuses and p.createdAt < :before")
    List<UUID> findStaleIds(Collection<PaymentStatus> statuses, Instant before);

    @Query("select count(p) from Payment p where p.restaurantId = :restaurantId and p.status = :status and p.createdAt >= :from")
    long countSince(UUID restaurantId, PaymentStatus status, Instant from);

    @Query("select coalesce(sum(p.amount), 0) from Payment p where p.restaurantId = :restaurantId and p.status = :status and p.createdAt >= :from")
    BigDecimal sumSince(UUID restaurantId, PaymentStatus status, Instant from);
}
