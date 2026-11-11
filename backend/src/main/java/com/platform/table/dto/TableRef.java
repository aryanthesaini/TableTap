package com.platform.table.dto;

import java.util.UUID;

/** Minimal table view shared with other modules (public ordering). */
public record TableRef(UUID id, UUID restaurantId, String name, boolean active) {}
