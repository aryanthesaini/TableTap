package com.platform.menu;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MenuItemRepository extends JpaRepository<MenuItem, UUID> {

    List<MenuItem> findAllByRestaurantIdOrderBySortOrderAscNameAsc(UUID restaurantId);

    List<MenuItem> findAllByRestaurantIdAndCategoryId(UUID restaurantId, UUID categoryId);

    List<MenuItem> findAllByRestaurantIdAndIdIn(UUID restaurantId, Collection<UUID> ids);

    Optional<MenuItem> findByIdAndRestaurantId(UUID id, UUID restaurantId);

    long countByRestaurantId(UUID restaurantId);

    @Query("select coalesce(max(i.sortOrder), 0) from MenuItem i where i.restaurantId = :restaurantId and i.categoryId = :categoryId")
    int maxSortOrder(UUID restaurantId, UUID categoryId);
}
