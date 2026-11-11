package com.platform.menu;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MenuCategoryRepository extends JpaRepository<MenuCategory, UUID> {

    List<MenuCategory> findAllByRestaurantIdOrderBySortOrderAscNameAsc(UUID restaurantId);

    Optional<MenuCategory> findByIdAndRestaurantId(UUID id, UUID restaurantId);

    @Query("select c from MenuCategory c where c.restaurantId = :restaurantId and lower(c.name) = lower(:name)")
    Optional<MenuCategory> findByRestaurantIdAndNameIgnoreCase(UUID restaurantId, String name);

    @Query("select coalesce(max(c.sortOrder), 0) from MenuCategory c where c.restaurantId = :restaurantId")
    int maxSortOrder(UUID restaurantId);
}
