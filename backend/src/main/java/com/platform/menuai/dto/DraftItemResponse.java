package com.platform.menuai.dto;

import com.platform.menu.Dietary;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record DraftItemResponse(UUID id, String categoryName, String name, String description, BigDecimal price,
                                Dietary dietary, BigDecimal confidence, List<String> uncertainFields,
                                boolean included, int sortOrder) {}
