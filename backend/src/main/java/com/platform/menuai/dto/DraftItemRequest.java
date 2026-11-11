package com.platform.menuai.dto;

import com.platform.menu.Dietary;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

/** Owner edits to a draft row. Saving a row marks its edited fields as reviewed. */
public record DraftItemRequest(
        @NotBlank @Size(max = 80) String categoryName,
        @NotBlank @Size(max = 120) String name,
        @Size(max = 500) String description,
        @DecimalMin("0.00") @DecimalMax("999999.99") @Digits(integer = 6, fraction = 2) BigDecimal price,
        Dietary dietary,
        @NotNull Boolean included
) {}
