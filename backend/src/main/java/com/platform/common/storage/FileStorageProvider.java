package com.platform.common.storage;

import org.springframework.core.io.Resource;

import java.io.InputStream;
import java.util.Optional;

/**
 * Object storage abstraction. {@link LocalFileStorageProvider} is used for the MVP; an S3 implementation
 * would return pre-signed or CDN URLs from {@link StoredFile#url()}.
 */
public interface FileStorageProvider {

    StoredFile store(String directory, String originalFilename, String contentType, InputStream content, long size);

    Optional<Resource> load(String key);

    void delete(String key);
}
