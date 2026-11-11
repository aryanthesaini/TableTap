package com.platform.table.dto;

import jakarta.validation.constraints.NotNull;

public record TableStatusRequest(@NotNull Boolean active) {}
