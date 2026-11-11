package com.platform.table;

import com.platform.table.dto.TableRef;
import com.platform.table.dto.TableRequest;
import com.platform.table.dto.TableResponse;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TableService {

    List<TableResponse> list(UUID restaurantId);

    TableResponse create(UUID restaurantId, TableRequest request);

    TableResponse update(UUID restaurantId, UUID tableId, TableRequest request);

    TableResponse setActive(UUID restaurantId, UUID tableId, boolean active);

    /** Issues a new QR token; previously printed QR codes for this table stop working. */
    TableResponse regenerateQr(UUID restaurantId, UUID tableId);

    void delete(UUID restaurantId, UUID tableId);

    /** Resolves a QR token to its table (including inactive tables so callers can show a clear message). */
    Optional<TableRef> findByQrToken(String qrToken);

    Optional<TableRef> find(UUID restaurantId, UUID tableId);
}
