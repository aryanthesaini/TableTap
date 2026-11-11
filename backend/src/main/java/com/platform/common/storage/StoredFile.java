package com.platform.common.storage;

/**
 * @param key  provider-specific object key (e.g. {@code menu-images/<restaurant>/<uuid>.jpg})
 * @param url  URL clients can use to fetch the file
 */
public record StoredFile(String key, String url, String contentType, long size) {}
