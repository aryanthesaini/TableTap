package com.platform.menu;

import com.platform.common.error.BusinessRuleException;
import com.platform.common.error.ConflictException;
import com.platform.common.error.NotFoundException;
import com.platform.common.storage.FileStorageProvider;
import com.platform.common.storage.StoredFile;
import com.platform.menu.dto.CategoryRequest;
import com.platform.menu.dto.CategoryResponse;
import com.platform.menu.dto.ImageUploadResponse;
import com.platform.menu.dto.MenuImportItem;
import com.platform.menu.dto.MenuImportResult;
import com.platform.menu.dto.MenuItemRequest;
import com.platform.menu.dto.MenuItemResponse;
import com.platform.menu.dto.MenuResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class MenuServiceImpl implements MenuService {

    private static final Set<String> IMAGE_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private final MenuCategoryRepository categoryRepository;
    private final MenuItemRepository itemRepository;
    private final FileStorageProvider storage;
    private final Clock clock;

    public MenuServiceImpl(MenuCategoryRepository categoryRepository, MenuItemRepository itemRepository,
                           FileStorageProvider storage, Clock clock) {
        this.categoryRepository = categoryRepository;
        this.itemRepository = itemRepository;
        this.storage = storage;
        this.clock = clock;
    }

    @Override
    public MenuResponse getMenu(UUID restaurantId) {
        List<MenuCategory> categories = categoryRepository.findAllByRestaurantIdOrderBySortOrderAscNameAsc(restaurantId);
        Map<UUID, List<MenuItemResponse>> itemsByCategory = itemRepository
                .findAllByRestaurantIdOrderBySortOrderAscNameAsc(restaurantId).stream()
                .map(MenuServiceImpl::toResponse)
                .collect(Collectors.groupingBy(MenuItemResponse::categoryId));
        List<CategoryResponse> result = categories.stream()
                .map(c -> toResponse(c, itemsByCategory.getOrDefault(c.getId(), List.of())))
                .toList();
        int total = result.stream().mapToInt(c -> c.items().size()).sum();
        int unavailable = (int) result.stream().flatMap(c -> c.items().stream()).filter(i -> !i.available()).count();
        return new MenuResponse(result, total, unavailable);
    }

    @Override
    @Transactional
    public CategoryResponse createCategory(UUID restaurantId, CategoryRequest request) {
        String name = request.name().trim();
        ensureCategoryNameFree(restaurantId, name, null);
        MenuCategory category = new MenuCategory();
        category.setRestaurantId(restaurantId);
        category.setName(name);
        category.setDescription(blankToNull(request.description()));
        category.setSortOrder(categoryRepository.maxSortOrder(restaurantId) + 1);
        return toResponse(categoryRepository.save(category), List.of());
    }

    @Override
    @Transactional
    public CategoryResponse updateCategory(UUID restaurantId, UUID categoryId, CategoryRequest request) {
        MenuCategory category = loadCategory(restaurantId, categoryId);
        String name = request.name().trim();
        ensureCategoryNameFree(restaurantId, name, categoryId);
        category.setName(name);
        category.setDescription(blankToNull(request.description()));
        List<MenuItemResponse> items = itemRepository.findAllByRestaurantIdAndCategoryId(restaurantId, categoryId)
                .stream().map(MenuServiceImpl::toResponse).toList();
        return toResponse(category, items);
    }

    @Override
    @Transactional
    public void deleteCategory(UUID restaurantId, UUID categoryId) {
        MenuCategory category = loadCategory(restaurantId, categoryId);
        var now = clock.instant();
        itemRepository.findAllByRestaurantIdAndCategoryId(restaurantId, categoryId)
                .forEach(item -> item.setDeletedAt(now));
        category.setDeletedAt(now);
    }

    @Override
    @Transactional
    public void reorderCategories(UUID restaurantId, List<UUID> orderedIds) {
        Map<UUID, MenuCategory> byId = categoryRepository.findAllByRestaurantIdOrderBySortOrderAscNameAsc(restaurantId)
                .stream().collect(Collectors.toMap(MenuCategory::getId, c -> c));
        applyOrder(orderedIds, byId.keySet());
        for (int i = 0; i < orderedIds.size(); i++) {
            byId.get(orderedIds.get(i)).setSortOrder(i + 1);
        }
    }

    @Override
    @Transactional
    public MenuItemResponse createItem(UUID restaurantId, MenuItemRequest request) {
        loadCategory(restaurantId, request.categoryId());
        MenuItem item = new MenuItem();
        item.setRestaurantId(restaurantId);
        apply(item, request);
        item.setAvailable(request.available() == null || request.available());
        item.setSortOrder(itemRepository.maxSortOrder(restaurantId, request.categoryId()) + 1);
        return toResponse(itemRepository.save(item));
    }

    @Override
    @Transactional
    public MenuItemResponse updateItem(UUID restaurantId, UUID itemId, MenuItemRequest request) {
        MenuItem item = loadItem(restaurantId, itemId);
        if (!item.getCategoryId().equals(request.categoryId())) {
            loadCategory(restaurantId, request.categoryId());
            item.setSortOrder(itemRepository.maxSortOrder(restaurantId, request.categoryId()) + 1);
        }
        apply(item, request);
        if (request.available() != null) {
            item.setAvailable(request.available());
        }
        return toResponse(itemRepository.saveAndFlush(item));
    }

    @Override
    @Transactional
    public MenuItemResponse setAvailability(UUID restaurantId, UUID itemId, boolean available) {
        MenuItem item = loadItem(restaurantId, itemId);
        item.setAvailable(available);
        return toResponse(itemRepository.saveAndFlush(item));
    }

    @Override
    @Transactional
    public void deleteItem(UUID restaurantId, UUID itemId) {
        loadItem(restaurantId, itemId).setDeletedAt(clock.instant());
    }

    @Override
    @Transactional
    public void reorderItems(UUID restaurantId, UUID categoryId, List<UUID> orderedIds) {
        loadCategory(restaurantId, categoryId);
        Map<UUID, MenuItem> byId = itemRepository.findAllByRestaurantIdAndCategoryId(restaurantId, categoryId)
                .stream().collect(Collectors.toMap(MenuItem::getId, i -> i));
        applyOrder(orderedIds, byId.keySet());
        for (int i = 0; i < orderedIds.size(); i++) {
            byId.get(orderedIds.get(i)).setSortOrder(i + 1);
        }
    }

    @Override
    public ImageUploadResponse uploadImage(UUID restaurantId, MultipartFile file) {
        if (file.isEmpty()) {
            throw new BusinessRuleException("EMPTY_FILE", "Please choose an image to upload");
        }
        if (file.getContentType() == null || !IMAGE_TYPES.contains(file.getContentType())) {
            throw new BusinessRuleException("UNSUPPORTED_FILE_TYPE", "Images must be JPEG, PNG or WebP");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new BusinessRuleException("FILE_TOO_LARGE", "Images must be 5 MB or smaller");
        }
        try {
            StoredFile stored = storage.store("menu-images/" + restaurantId, file.getOriginalFilename(),
                    file.getContentType(), file.getInputStream(), file.getSize());
            return new ImageUploadResponse(stored.url());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public List<MenuItemResponse> findItems(UUID restaurantId, Collection<UUID> itemIds) {
        if (itemIds.isEmpty()) {
            return List.of();
        }
        return itemRepository.findAllByRestaurantIdAndIdIn(restaurantId, itemIds).stream()
                .map(MenuServiceImpl::toResponse).toList();
    }

    @Override
    @Transactional
    public MenuImportResult importItems(UUID restaurantId, List<MenuImportItem> items) {
        Map<String, MenuCategory> categories = new HashMap<>();
        int categoriesCreated = 0;
        int nextCategoryOrder = categoryRepository.maxSortOrder(restaurantId);
        List<MenuItem> toSave = new ArrayList<>();
        Map<UUID, Integer> nextItemOrder = new HashMap<>();

        for (MenuImportItem in : items) {
            String key = in.categoryName().trim().toLowerCase();
            MenuCategory category = categories.get(key);
            if (category == null) {
                category = categoryRepository.findByRestaurantIdAndNameIgnoreCase(restaurantId, in.categoryName().trim())
                        .orElse(null);
                if (category == null) {
                    category = new MenuCategory();
                    category.setRestaurantId(restaurantId);
                    category.setName(in.categoryName().trim());
                    category.setSortOrder(++nextCategoryOrder);
                    category = categoryRepository.save(category);
                    categoriesCreated++;
                }
                categories.put(key, category);
            }
            UUID categoryId = category.getId();
            int order = nextItemOrder.computeIfAbsent(categoryId, id -> itemRepository.maxSortOrder(restaurantId, id)) + 1;
            nextItemOrder.put(categoryId, order);

            MenuItem item = new MenuItem();
            item.setRestaurantId(restaurantId);
            item.setCategoryId(categoryId);
            item.setName(in.name().trim());
            item.setDescription(blankToNull(in.description()));
            item.setPrice(in.price());
            item.setDietary(in.dietary());
            item.setAvailable(true);
            item.setSortOrder(order);
            toSave.add(item);
        }
        itemRepository.saveAll(toSave);
        return new MenuImportResult(categoriesCreated, toSave.size());
    }

    // ------------------------------------------------------------------

    private void apply(MenuItem item, MenuItemRequest request) {
        item.setCategoryId(request.categoryId());
        item.setName(request.name().trim());
        item.setDescription(blankToNull(request.description()));
        item.setPrice(request.price());
        item.setImageUrl(blankToNull(request.imageUrl()));
        item.setDietary(request.dietary());
        item.setFeatured(Boolean.TRUE.equals(request.featured()));
    }

    private static void applyOrder(List<UUID> orderedIds, Set<UUID> existing) {
        if (orderedIds.size() != existing.size() || !new HashSet<>(orderedIds).equals(existing)) {
            throw new BusinessRuleException("INVALID_ORDER", "The reorder list must contain each item exactly once");
        }
    }

    private void ensureCategoryNameFree(UUID restaurantId, String name, UUID exceptId) {
        categoryRepository.findByRestaurantIdAndNameIgnoreCase(restaurantId, name)
                .filter(existing -> !existing.getId().equals(exceptId))
                .ifPresent(existing -> {
                    throw new ConflictException("CATEGORY_EXISTS", "A category named \"" + name + "\" already exists");
                });
    }

    private MenuCategory loadCategory(UUID restaurantId, UUID categoryId) {
        return categoryRepository.findByIdAndRestaurantId(categoryId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Category"));
    }

    private MenuItem loadItem(UUID restaurantId, UUID itemId) {
        return itemRepository.findByIdAndRestaurantId(itemId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Menu item"));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    static MenuItemResponse toResponse(MenuItem i) {
        return new MenuItemResponse(i.getId(), i.getCategoryId(), i.getName(), i.getDescription(), i.getPrice(),
                i.getImageUrl(), i.isAvailable(), i.getDietary(), i.isFeatured(), i.getSortOrder(), i.getUpdatedAt());
    }

    static CategoryResponse toResponse(MenuCategory c, List<MenuItemResponse> items) {
        return new CategoryResponse(c.getId(), c.getName(), c.getDescription(), c.getSortOrder(), items);
    }
}
