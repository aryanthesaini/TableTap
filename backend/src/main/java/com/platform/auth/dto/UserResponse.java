package com.platform.auth.dto;

import com.platform.common.security.UserRole;

import java.time.Instant;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String email,
        String fullName,
        UserRole role,
        UUID restaurantId,
        String restaurantName,
        String restaurantSlug,
        Instant lastLoginAt
) {}
