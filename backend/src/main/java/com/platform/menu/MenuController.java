package com.platform.menu;

import com.platform.common.config.OpenApiConfig;
import com.platform.common.security.CurrentUserProvider;
import com.platform.menu.dto.AvailabilityRequest;
import com.platform.menu.dto.CategoryRequest;
import com.platform.menu.dto.CategoryResponse;
import com.platform.menu.dto.ImageUploadResponse;
import com.platform.menu.dto.MenuItemRequest;
import com.platform.menu.dto.MenuItemResponse;
import com.platform.menu.dto.MenuResponse;
import com.platform.menu.dto.ReorderRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

@Tag(name = "Menu management")
@SecurityRequirement(name = OpenApiConfig.BEARER)
@RestController
@RequestMapping("/api/v1/restaurant/menu")
public class MenuController {

    private final MenuService menuService;
    private final CurrentUserProvider currentUser;

    public MenuController(MenuService menuService, CurrentUserProvider currentUser) {
        this.menuService = menuService;
        this.currentUser = currentUser;
    }

    @Operation(summary = "Full menu with categories and items")
    @GetMapping
    public MenuResponse getMenu() {
        return menuService.getMenu(currentUser.restaurantId());
    }

    // ---- categories (owner) ----

    @Operation(summary = "Create a category")
    @PreAuthorize("hasRole('OWNER')")
    @PostMapping("/categories")
    @ResponseStatus(HttpStatus.CREATED)
    public CategoryResponse createCategory(@Valid @RequestBody CategoryRequest request) {
        return menuService.createCategory(currentUser.restaurantId(), request);
    }

    @Operation(summary = "Rename / describe a category")
    @PreAuthorize("hasRole('OWNER')")
    @PutMapping("/categories/{categoryId}")
    public CategoryResponse updateCategory(@PathVariable UUID categoryId, @Valid @RequestBody CategoryRequest request) {
        return menuService.updateCategory(currentUser.restaurantId(), categoryId, request);
    }

    @Operation(summary = "Delete a category and its items (soft delete)")
    @PreAuthorize("hasRole('OWNER')")
    @DeleteMapping("/categories/{categoryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCategory(@PathVariable UUID categoryId) {
        menuService.deleteCategory(currentUser.restaurantId(), categoryId);
    }

    @Operation(summary = "Reorder categories")
    @PreAuthorize("hasRole('OWNER')")
    @PutMapping("/categories/order")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorderCategories(@Valid @RequestBody ReorderRequest request) {
        menuService.reorderCategories(currentUser.restaurantId(), request.orderedIds());
    }

    @Operation(summary = "Reorder items within a category")
    @PreAuthorize("hasRole('OWNER')")
    @PutMapping("/categories/{categoryId}/items/order")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reorderItems(@PathVariable UUID categoryId, @Valid @RequestBody ReorderRequest request) {
        menuService.reorderItems(currentUser.restaurantId(), categoryId, request.orderedIds());
    }

    // ---- items ----

    @Operation(summary = "Add a menu item")
    @PreAuthorize("hasRole('OWNER')")
    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    public MenuItemResponse createItem(@Valid @RequestBody MenuItemRequest request) {
        return menuService.createItem(currentUser.restaurantId(), request);
    }

    @Operation(summary = "Edit a menu item (name, price, category, image, …)")
    @PreAuthorize("hasRole('OWNER')")
    @PutMapping("/items/{itemId}")
    public MenuItemResponse updateItem(@PathVariable UUID itemId, @Valid @RequestBody MenuItemRequest request) {
        return menuService.updateItem(currentUser.restaurantId(), itemId, request);
    }

    @Operation(summary = "Mark an item available / sold out (owner and staff)")
    @PatchMapping("/items/{itemId}/availability")
    public MenuItemResponse setAvailability(@PathVariable UUID itemId, @Valid @RequestBody AvailabilityRequest request) {
        return menuService.setAvailability(currentUser.restaurantId(), itemId, request.available());
    }

    @Operation(summary = "Delete a menu item (soft delete)")
    @PreAuthorize("hasRole('OWNER')")
    @DeleteMapping("/items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteItem(@PathVariable UUID itemId) {
        menuService.deleteItem(currentUser.restaurantId(), itemId);
    }

    @Operation(summary = "Upload a food image; returns its URL to use in an item")
    @PreAuthorize("hasRole('OWNER')")
    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ImageUploadResponse uploadImage(@RequestPart("file") MultipartFile file) {
        return menuService.uploadImage(currentUser.restaurantId(), file);
    }
}
