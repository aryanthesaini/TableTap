package com.platform.menuai;

import com.platform.common.config.OpenApiConfig;
import com.platform.common.security.CurrentUser;
import com.platform.common.security.CurrentUserProvider;
import com.platform.menuai.dto.DraftItemRequest;
import com.platform.menuai.dto.DraftItemResponse;
import com.platform.menuai.dto.MenuUploadResponse;
import com.platform.menuai.dto.PublishResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@Tag(name = "AI menu onboarding")
@SecurityRequirement(name = OpenApiConfig.BEARER)
@RestController
@RequestMapping("/api/v1/restaurant/menu-imports")
@PreAuthorize("hasRole('OWNER')")
public class MenuOnboardingController {

    private final MenuOnboardingService service;
    private final CurrentUserProvider currentUser;

    public MenuOnboardingController(MenuOnboardingService service, CurrentUserProvider currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @Operation(summary = "Upload a menu (PDF or image); extraction runs in the background")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.ACCEPTED)
    public MenuUploadResponse upload(@RequestPart("file") MultipartFile file) {
        CurrentUser user = currentUser.get();
        return service.upload(user.requireRestaurantId(), user.userId(), file);
    }

    @Operation(summary = "Recent uploads")
    @GetMapping
    public List<MenuUploadResponse> list() {
        return service.list(currentUser.restaurantId());
    }

    @Operation(summary = "Upload with extracted draft items")
    @GetMapping("/{uploadId}")
    public MenuUploadResponse get(@PathVariable UUID uploadId) {
        return service.get(currentUser.restaurantId(), uploadId);
    }

    @Operation(summary = "Edit a draft item (marks it reviewed)")
    @PutMapping("/{uploadId}/items/{itemId}")
    public DraftItemResponse updateItem(@PathVariable UUID uploadId, @PathVariable UUID itemId,
                                        @Valid @RequestBody DraftItemRequest request) {
        return service.updateItem(currentUser.restaurantId(), uploadId, itemId, request);
    }

    @Operation(summary = "Add an item the extractor missed")
    @PostMapping("/{uploadId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    public DraftItemResponse addItem(@PathVariable UUID uploadId, @Valid @RequestBody DraftItemRequest request) {
        return service.addItem(currentUser.restaurantId(), uploadId, request);
    }

    @Operation(summary = "Remove a draft item")
    @DeleteMapping("/{uploadId}/items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteItem(@PathVariable UUID uploadId, @PathVariable UUID itemId) {
        service.deleteItem(currentUser.restaurantId(), uploadId, itemId);
    }

    @Operation(summary = "Approve and publish included items to the live menu")
    @PostMapping("/{uploadId}/publish")
    public PublishResponse publish(@PathVariable UUID uploadId) {
        return service.publish(currentUser.restaurantId(), uploadId);
    }

    @Operation(summary = "Discard this upload")
    @PostMapping("/{uploadId}/discard")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void discard(@PathVariable UUID uploadId) {
        service.discard(currentUser.restaurantId(), uploadId);
    }
}
