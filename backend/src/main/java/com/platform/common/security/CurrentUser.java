package com.platform.common.security;

import org.springframework.security.access.AccessDeniedException;

import java.util.UUID;

/**
 * The authenticated principal, derived from the verified JWT. The restaurant (tenant) id is
 * always taken from here — never from request paths or bodies.
 */
public record CurrentUser(UUID userId, UUID restaurantId, UserRole role, String email, String fullName) {

    public UUID requireRestaurantId() {
        if (restaurantId == null) {
            throw new AccessDeniedException("Not a restaurant user");
        }
        return restaurantId;
    }

    public boolean isOwner() {
        return role == UserRole.OWNER;
    }
}
