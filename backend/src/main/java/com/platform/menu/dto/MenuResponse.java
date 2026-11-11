package com.platform.menu.dto;

import java.util.List;

public record MenuResponse(List<CategoryResponse> categories, int totalItems, int unavailableItems) {}
