package com.platform.menuai.dto;

import com.platform.menuai.MenuUploadStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** {@code items} is only populated on the detail endpoint. */
public record MenuUploadResponse(
        UUID id,
        String originalFilename,
        String contentType,
        long fileSize,
        String fileUrl,
        MenuUploadStatus status,
        String extractionProvider,
        String errorMessage,
        int itemCount,
        int uncertainCount,
        Integer publishedItemCount,
        Instant publishedAt,
        Instant createdAt,
        List<DraftItemResponse> items
) {}
