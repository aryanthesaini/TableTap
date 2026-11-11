package com.platform.table;

import com.platform.common.config.OpenApiConfig;
import com.platform.common.security.CurrentUserProvider;
import com.platform.table.dto.TableRequest;
import com.platform.table.dto.TableResponse;
import com.platform.table.dto.TableStatusRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@Tag(name = "Tables & QR codes")
@SecurityRequirement(name = OpenApiConfig.BEARER)
@RestController
@RequestMapping("/api/v1/restaurant/tables")
public class TableController {

    private final TableService tableService;
    private final CurrentUserProvider currentUser;

    public TableController(TableService tableService, CurrentUserProvider currentUser) {
        this.tableService = tableService;
        this.currentUser = currentUser;
    }

    @Operation(summary = "List tables with their QR ordering URLs")
    @GetMapping
    public List<TableResponse> list() {
        return tableService.list(currentUser.restaurantId());
    }

    @Operation(summary = "Create a table (a QR token is generated automatically)")
    @PreAuthorize("hasRole('OWNER')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TableResponse create(@Valid @RequestBody TableRequest request) {
        return tableService.create(currentUser.restaurantId(), request);
    }

    @Operation(summary = "Rename a table / change seats")
    @PreAuthorize("hasRole('OWNER')")
    @PutMapping("/{tableId}")
    public TableResponse update(@PathVariable UUID tableId, @Valid @RequestBody TableRequest request) {
        return tableService.update(currentUser.restaurantId(), tableId, request);
    }

    @Operation(summary = "Activate or deactivate a table")
    @PreAuthorize("hasRole('OWNER')")
    @PatchMapping("/{tableId}/status")
    public TableResponse setStatus(@PathVariable UUID tableId, @Valid @RequestBody TableStatusRequest request) {
        return tableService.setActive(currentUser.restaurantId(), tableId, request.active());
    }

    @Operation(summary = "Regenerate the table's QR code (old printed codes stop working)")
    @PreAuthorize("hasRole('OWNER')")
    @PostMapping("/{tableId}/qr/regenerate")
    public TableResponse regenerateQr(@PathVariable UUID tableId) {
        return tableService.regenerateQr(currentUser.restaurantId(), tableId);
    }

    @Operation(summary = "Remove a table (soft delete; order history is kept)")
    @PreAuthorize("hasRole('OWNER')")
    @DeleteMapping("/{tableId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID tableId) {
        tableService.delete(currentUser.restaurantId(), tableId);
    }
}
