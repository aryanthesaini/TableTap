package com.platform.common.error;

import lombok.Getter;
import org.springframework.http.HttpStatus;

/** Base class for business errors that map to a specific HTTP status and machine-readable code. */
@Getter
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    public ApiException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }
}
