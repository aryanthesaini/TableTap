package com.platform.common.storage;

import io.swagger.v3.oas.annotations.Hidden;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/** Serves files written by {@link LocalFileStorageProvider}. Not needed once files live on S3/CDN. */
@Hidden
@RestController
public class FileController {

    private final FileStorageProvider storage;

    public FileController(FileStorageProvider storage) {
        this.storage = storage;
    }

    @GetMapping("/files/**")
    public ResponseEntity<Resource> serve(HttpServletRequest request) {
        String key = request.getRequestURI().substring("/files/".length());
        return storage.load(key)
                .map(resource -> ResponseEntity.ok()
                        .contentType(MediaTypeFactory.getMediaType(resource).orElse(MediaType.APPLICATION_OCTET_STREAM))
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePublic())
                        .body(resource))
                .orElse(ResponseEntity.notFound().build());
    }
}
