package com.platform.restaurant;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RestaurantRepository extends JpaRepository<Restaurant, UUID> {

    Optional<Restaurant> findBySlug(String slug);

    List<Restaurant> findAllByOrderByNameAsc();

    long countByStatus(RestaurantStatus status);

    /** Atomically allocates the next per-restaurant order number (row lock held until commit). */
    @Query(value = "UPDATE restaurant SET order_sequence = order_sequence + 1 WHERE id = :id RETURNING order_sequence",
            nativeQuery = true)
    int incrementAndGetOrderSequence(@Param("id") UUID id);
}
