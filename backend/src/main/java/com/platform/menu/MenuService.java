package com.platform.menu;

import com.platform.menu.dto.CategoryRequest;
import com.platform.menu.dto.CategoryResponse;
import com.platform.menu.dto.ImageUploadResponse;
import com.platform.menu.dto.MenuImportItem;
import com.platform.menu.dto.MenuImportResult;
import com.platform.menu.dto.MenuItemRequest;
import com.platform.menu.dto.MenuItemResponse;
import com.platform.menu.dto.MenuResponse;
import org.springframework.web.multipart.MultipartFile;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * Menu management for one restaurant. Every method takes the tenant id explicitly and only
 * touches rows belonging to that restaurant.
 */
public interface MenuService {

    /** Full menu (categories with items), including unavailable items. */
    MenuResponse getMenu(UUID restaurantId);

    CategoryResponse createCategory(UUID restaurantId, CategoryRequest request);

    CategoryResponse updateCategory(UUID restaurantId, UUID categoryId, CategoryRequest request);

    /** Soft-deletes the category and the items inside it. */
    void deleteCategory(UUID restaurantId, UUID categoryId);

    void reorderCategories(UUID restaurantId, List<UUID> orderedIds);

    MenuItemResponse createItem(UUID restaurantId, MenuItemRequest request);

    MenuItemResponse updateItem(UUID restaurantId, UUID itemId, MenuItemRequest request);

    MenuItemResponse setAvailability(UUID restaurantId, UUID itemId, boolean available);

    void deleteItem(UUID restaurantId, UUID itemId);

    void reorderItems(UUID restaurantId, UUID categoryId, List<UUID> orderedIds);

    ImageUploadResponse uploadImage(UUID restaurantId, MultipartFile file);

    /** Items by id for pricing a cart. Only returns non-deleted items of this restaurant. */
    List<MenuItemResponse> findItems(UUID restaurantId, Collection<UUID> itemIds);

    MenuImportResult importItems(UUID restaurantId, List<MenuImportItem> items);
}
