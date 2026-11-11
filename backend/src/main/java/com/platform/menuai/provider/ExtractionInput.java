package com.platform.menuai.provider;

/** What an extraction provider receives. {@code fileKey} is readable through FileStorageProvider. */
public record ExtractionInput(String fileKey, String contentType, String originalFilename, String restaurantName) {}
