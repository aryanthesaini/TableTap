package com.platform.menu.dto;

import java.util.List;
import java.util.UUID;

public record CategoryResponse(
        UUID id,
        String name,
        String description,
        int sortOrder,
        List<MenuItemResponse> items
) {}
