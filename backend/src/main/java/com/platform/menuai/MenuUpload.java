package com.platform.menuai;

import com.platform.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "menu_upload")
public class MenuUpload extends BaseEntity {

    @Column(nullable = false, updatable = false)
    private UUID restaurantId;

    @Column(nullable = false)
    private String originalFilename;

    @Column(nullable = false)
    private String contentType;

    @Column(nullable = false)
    private long fileSize;

    @Column(nullable = false)
    private String fileKey;

    @Column(nullable = false)
    private String fileUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MenuUploadStatus status = MenuUploadStatus.PROCESSING;

    private String extractionProvider;
    private String errorMessage;
    private UUID uploadedBy;
    private Instant publishedAt;
    private Integer publishedItemCount;
}
