package com.platform.menuai;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MenuDraftItemRepository extends JpaRepository<MenuDraftItem, UUID> {

    List<MenuDraftItem> findAllByUploadIdOrderBySortOrderAsc(UUID uploadId);

    Optional<MenuDraftItem> findByIdAndUploadIdAndRestaurantId(UUID id, UUID uploadId, UUID restaurantId);

    @Query("select coalesce(max(d.sortOrder), 0) from MenuDraftItem d where d.uploadId = :uploadId")
    int maxSortOrder(UUID uploadId);
}
