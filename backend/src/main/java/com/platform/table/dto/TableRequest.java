package com.platform.table.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record TableRequest(
        @NotBlank @Size(max = 60) String name,
        @Min(1) @Max(50) Integer seats
) {}
