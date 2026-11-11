package com.platform.menuai;

import com.platform.menuai.dto.DraftItemRequest;
import com.platform.menuai.dto.DraftItemResponse;
import com.platform.menuai.dto.MenuUploadResponse;
import com.platform.menuai.dto.PublishResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

/** Upload a menu file → AI extraction (async) → owner review → explicit publish into the live menu. */
public interface MenuOnboardingService {

    MenuUploadResponse upload(UUID restaurantId, UUID userId, MultipartFile file);

    List<MenuUploadResponse> list(UUID restaurantId);

    MenuUploadResponse get(UUID restaurantId, UUID uploadId);

    DraftItemResponse updateItem(UUID restaurantId, UUID uploadId, UUID itemId, DraftItemRequest request);

    DraftItemResponse addItem(UUID restaurantId, UUID uploadId, DraftItemRequest request);

    void deleteItem(UUID restaurantId, UUID uploadId, UUID itemId);

    PublishResponse publish(UUID restaurantId, UUID uploadId);

    void discard(UUID restaurantId, UUID uploadId);

    /** Runs extraction for an upload. Invoked asynchronously after the upload commits. */
    void runExtraction(UUID uploadId);
}
