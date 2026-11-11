package com.platform.menuai.provider;

import com.platform.menu.Dietary;

import java.math.BigDecimal;
import java.util.List;

/**
 * @param confidence      0.0–1.0 overall confidence for the row
 * @param uncertainFields fields the model could not read reliably ("name", "price", "dietary", "category", "description")
 */
public record ExtractedItem(String categoryName, String name, String description, BigDecimal price, Dietary dietary,
                            double confidence, List<String> uncertainFields) {}
