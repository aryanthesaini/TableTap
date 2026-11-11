package com.platform.table;

import com.platform.common.config.AppProperties;
import com.platform.common.error.ConflictException;
import com.platform.common.error.NotFoundException;
import com.platform.common.util.SecureTokens;
import com.platform.restaurant.RestaurantService;
import com.platform.table.dto.TableRef;
import com.platform.table.dto.TableRequest;
import com.platform.table.dto.TableResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class TableServiceImpl implements TableService {

    static final int TOKEN_LENGTH = 12;

    private final RestaurantTableRepository repository;
    private final RestaurantService restaurantService;
    private final AppProperties properties;
    private final Clock clock;

    public TableServiceImpl(RestaurantTableRepository repository, RestaurantService restaurantService,
                            AppProperties properties, Clock clock) {
        this.repository = repository;
        this.restaurantService = restaurantService;
        this.properties = properties;
        this.clock = clock;
    }

    @Override
    public List<TableResponse> list(UUID restaurantId) {
        String slug = restaurantService.get(restaurantId).slug();
        return repository.findAllByRestaurantIdOrderBySortOrderAscNameAsc(restaurantId).stream()
                .map(t -> toResponse(t, slug)).toList();
    }

    @Override
    @Transactional
    public TableResponse create(UUID restaurantId, TableRequest request) {
        String name = request.name().trim();
        ensureNameFree(restaurantId, name, null);
        RestaurantTable table = new RestaurantTable();
        table.setRestaurantId(restaurantId);
        table.setName(name);
        table.setSeats(request.seats());
        table.setQrToken(newToken());
        table.setQrGeneratedAt(clock.instant());
        table.setSortOrder(repository.maxSortOrder(restaurantId) + 1);
        return toResponse(repository.save(table), slugOf(restaurantId));
    }

    @Override
    @Transactional
    public TableResponse update(UUID restaurantId, UUID tableId, TableRequest request) {
        RestaurantTable table = load(restaurantId, tableId);
        String name = request.name().trim();
        ensureNameFree(restaurantId, name, tableId);
        table.setName(name);
        table.setSeats(request.seats());
        return toResponse(repository.saveAndFlush(table), slugOf(restaurantId));
    }

    @Override
    @Transactional
    public TableResponse setActive(UUID restaurantId, UUID tableId, boolean active) {
        RestaurantTable table = load(restaurantId, tableId);
        table.setActive(active);
        return toResponse(repository.saveAndFlush(table), slugOf(restaurantId));
    }

    @Override
    @Transactional
    public TableResponse regenerateQr(UUID restaurantId, UUID tableId) {
        RestaurantTable table = load(restaurantId, tableId);
        table.setQrToken(newToken());
        table.setQrGeneratedAt(clock.instant());
        return toResponse(repository.saveAndFlush(table), slugOf(restaurantId));
    }

    @Override
    @Transactional
    public void delete(UUID restaurantId, UUID tableId) {
        RestaurantTable table = load(restaurantId, tableId);
        table.setDeletedAt(clock.instant());
        table.setActive(false);
    }

    @Override
    public Optional<TableRef> findByQrToken(String qrToken) {
        return repository.findByQrToken(qrToken).map(TableServiceImpl::toRef);
    }

    @Override
    public Optional<TableRef> find(UUID restaurantId, UUID tableId) {
        return repository.findByIdAndRestaurantId(tableId, restaurantId).map(TableServiceImpl::toRef);
    }

    // ------------------------------------------------------------------

    private String newToken() {
        String token;
        do {
            token = SecureTokens.base62(TOKEN_LENGTH);
        } while (repository.existsByQrToken(token));
        return token;
    }

    private void ensureNameFree(UUID restaurantId, String name, UUID exceptId) {
        if (repository.existsByName(restaurantId, name, exceptId)) {
            throw new ConflictException("TABLE_EXISTS", "A table named \"" + name + "\" already exists");
        }
    }

    private RestaurantTable load(UUID restaurantId, UUID tableId) {
        return repository.findByIdAndRestaurantId(tableId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Table"));
    }

    private String slugOf(UUID restaurantId) {
        return restaurantService.get(restaurantId).slug();
    }

    private TableResponse toResponse(RestaurantTable t, String slug) {
        String base = properties.publicBaseUrl().replaceAll("/+$", "");
        return new TableResponse(t.getId(), t.getName(), t.getSeats(), t.isActive(), t.getQrToken(),
                base + "/r/" + slug + "/t/" + t.getQrToken(), t.getQrGeneratedAt(), t.getSortOrder(), t.getCreatedAt());
    }

    private static TableRef toRef(RestaurantTable t) {
        return new TableRef(t.getId(), t.getRestaurantId(), t.getName(), t.isActive());
    }
}
