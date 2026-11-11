package com.platform.table;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, UUID> {

    List<RestaurantTable> findAllByRestaurantIdOrderBySortOrderAscNameAsc(UUID restaurantId);

    Optional<RestaurantTable> findByIdAndRestaurantId(UUID id, UUID restaurantId);

    Optional<RestaurantTable> findByQrToken(String qrToken);

    boolean existsByQrToken(String qrToken);

    @Query("select count(t) > 0 from RestaurantTable t where t.restaurantId = :restaurantId and lower(t.name) = lower(:name) and (:exceptId is null or t.id <> :exceptId)")
    boolean existsByName(UUID restaurantId, String name, UUID exceptId);

    @Query("select coalesce(max(t.sortOrder), 0) from RestaurantTable t where t.restaurantId = :restaurantId")
    int maxSortOrder(UUID restaurantId);

    long countByRestaurantIdAndActiveTrue(UUID restaurantId);
}
