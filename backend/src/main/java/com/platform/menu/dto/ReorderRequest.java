package com.platform.menu.dto;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

/** Full ordered list of ids; position in the list becomes the new sort order. */
public record ReorderRequest(@NotEmpty List<UUID> orderedIds) {}
