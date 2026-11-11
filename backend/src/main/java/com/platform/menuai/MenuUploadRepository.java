package com.platform.menuai;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MenuUploadRepository extends JpaRepository<MenuUpload, UUID> {

    List<MenuUpload> findTop20ByRestaurantIdOrderByCreatedAtDesc(UUID restaurantId);

    Optional<MenuUpload> findByIdAndRestaurantId(UUID id, UUID restaurantId);
}
