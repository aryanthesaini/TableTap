package com.platform.common.error;

import java.time.Instant;
import java.util.List;

/** Standard error body returned by every API endpoint. */
public record ErrorResponse(
        Instant timestamp,
        int status,
        String code,
        String message,
        String path,
        List<FieldError> fieldErrors
) {
    public record FieldError(String field, String message) {}
}
