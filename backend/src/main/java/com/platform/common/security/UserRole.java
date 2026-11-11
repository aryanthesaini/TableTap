package com.platform.common.security;

public enum UserRole {
    OWNER,
    STAFF,
    PLATFORM_ADMIN;

    public boolean isRestaurantUser() {
        return this == OWNER || this == STAFF;
    }
}
