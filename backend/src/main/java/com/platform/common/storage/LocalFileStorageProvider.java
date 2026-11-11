package com.platform.common.storage;

import com.platform.common.config.AppProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Component
@ConditionalOnProperty(name = "app.storage.provider", havingValue = "local", matchIfMissing = true)
public class LocalFileStorageProvider implements FileStorageProvider {

    private final Path root;
    private final String publicPath;

    public LocalFileStorageProvider(AppProperties properties) {
        this.root = Path.of(properties.storage().localRoot()).toAbsolutePath().normalize();
        this.publicPath = properties.storage().publicPath();
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot create storage root " + root, e);
        }
        log.info("Local file storage at {}", root);
    }

    @Override
    public StoredFile store(String directory, String originalFilename, String contentType, InputStream content, long size) {
        String extension = StringUtils.getFilenameExtension(originalFilename);
        String safeExt = extension == null ? "" : "." + extension.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        String key = directory.replaceAll("[^a-zA-Z0-9/_-]", "") + "/" + UUID.randomUUID() + safeExt;
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            Files.copy(content, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to store file", e);
        }
        return new StoredFile(key, publicPath + "/" + key, contentType, size);
    }

    @Override
    public Optional<Resource> load(String key) {
        try {
            Path path = resolve(key);
            if (!Files.isRegularFile(path)) {
                return Optional.empty();
            }
            return Optional.of(new UrlResource(path.toUri()));
        } catch (MalformedURLException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            log.warn("Could not delete {}", key, e);
        }
    }

    private Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root)) {
            throw new IllegalArgumentException("Invalid storage key");
        }
        return path;
    }
}
