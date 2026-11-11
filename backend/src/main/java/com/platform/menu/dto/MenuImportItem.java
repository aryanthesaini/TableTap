package com.platform.menu.dto;

import com.platform.menu.Dietary;

import java.math.BigDecimal;

/** An item to import into the menu (used by the AI onboarding module). */
public record MenuImportItem(String categoryName, String name, String description, BigDecimal price, Dietary dietary) {}
