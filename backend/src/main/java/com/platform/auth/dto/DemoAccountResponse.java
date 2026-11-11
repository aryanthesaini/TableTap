package com.platform.auth.dto;

import com.platform.common.security.UserRole;

public record DemoAccountResponse(String email, String password, String fullName, UserRole role,
                                  String restaurantName, String restaurantSlug) {}
