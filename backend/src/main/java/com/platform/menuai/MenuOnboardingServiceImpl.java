package com.platform.menuai;

import com.platform.common.config.AppProperties;
import com.platform.common.error.BusinessRuleException;
import com.platform.common.error.ConflictException;
import com.platform.common.error.NotFoundException;
import com.platform.common.storage.FileStorageProvider;
import com.platform.common.storage.StoredFile;
import com.platform.menu.MenuService;
import com.platform.menu.dto.MenuImportItem;
import com.platform.menu.dto.MenuImportResult;
import com.platform.menuai.dto.DraftItemRequest;
import com.platform.menuai.dto.DraftItemResponse;
import com.platform.menuai.dto.MenuUploadResponse;
import com.platform.menuai.dto.PublishResponse;
import com.platform.menuai.provider.ExtractedItem;
import com.platform.menuai.provider.ExtractionInput;
import com.platform.menuai.provider.ExtractionResult;
import com.platform.menuai.provider.MenuExtractionProvider;
import com.platform.restaurant.RestaurantService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@Transactional(readOnly = true)
public class MenuOnboardingServiceImpl implements MenuOnboardingService {

    private static final Set<String> ACCEPTED_TYPES = Set.of("application/pdf", "image/jpeg", "image/png", "image/webp");

    private final MenuUploadRepository uploadRepository;
    private final MenuDraftItemRepository draftRepository;
    private final MenuExtractionProvider extractionProvider;
    private final FileStorageProvider storage;
    private final MenuService menuService;
    private final RestaurantService restaurantService;
    private final TaskScheduler scheduler;
    private final TransactionTemplate transactionTemplate;
    private final AppProperties properties;
    private final Clock clock;

    public MenuOnboardingServiceImpl(MenuUploadRepository uploadRepository, MenuDraftItemRepository draftRepository,
                                     MenuExtractionProvider extractionProvider, FileStorageProvider storage,
                                     MenuService menuService, RestaurantService restaurantService,
                                     TaskScheduler scheduler, TransactionTemplate transactionTemplate,
                                     AppProperties properties, Clock clock) {
        this.uploadRepository = uploadRepository;
        this.draftRepository = draftRepository;
        this.extractionProvider = extractionProvider;
        this.storage = storage;
        this.menuService = menuService;
        this.restaurantService = restaurantService;
        this.scheduler = scheduler;
        this.transactionTemplate = transactionTemplate;
        this.properties = properties;
        this.clock = clock;
    }

    @Override
    @Transactional
    public MenuUploadResponse upload(UUID restaurantId, UUID userId, MultipartFile file) {
        if (file.isEmpty()) {
            throw new BusinessRuleException("EMPTY_FILE", "Please choose a menu file to upload");
        }
        if (file.getContentType() == null || !ACCEPTED_TYPES.contains(file.getContentType())) {
            throw new BusinessRuleException("UNSUPPORTED_FILE_TYPE", "Upload a PDF, JPEG, PNG or WebP file");
        }
        StoredFile stored;
        try {
            stored = storage.store("menu-uploads/" + restaurantId, file.getOriginalFilename(), file.getContentType(),
                    file.getInputStream(), file.getSize());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        MenuUpload upload = new MenuUpload();
        upload.setRestaurantId(restaurantId);
        upload.setOriginalFilename(file.getOriginalFilename() == null ? "menu" : file.getOriginalFilename());
        upload.setContentType(file.getContentType());
        upload.setFileSize(file.getSize());
        upload.setFileKey(stored.key());
        upload.setFileUrl(stored.url());
        upload.setUploadedBy(userId);
        upload.setStatus(MenuUploadStatus.PROCESSING);
        upload = uploadRepository.save(upload);

        UUID uploadId = upload.getId();
        // Start extraction only once the upload row is committed and visible to the worker thread.
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                scheduler.schedule(() -> runExtraction(uploadId),
                        clock.instant().plus(properties.menuAi().mockProcessingDelay()));
            }
        });
        return toResponse(upload, List.of(), false);
    }

    @Override
    public List<MenuUploadResponse> list(UUID restaurantId) {
        return uploadRepository.findTop20ByRestaurantIdOrderByCreatedAtDesc(restaurantId).stream()
                .map(u -> toResponse(u, draftRepository.findAllByUploadIdOrderBySortOrderAsc(u.getId()), false))
                .toList();
    }

    @Override
    public MenuUploadResponse get(UUID restaurantId, UUID uploadId) {
        MenuUpload upload = load(restaurantId, uploadId);
        return toResponse(upload, draftRepository.findAllByUploadIdOrderBySortOrderAsc(uploadId), true);
    }

    @Override
    @Transactional
    public DraftItemResponse updateItem(UUID restaurantId, UUID uploadId, UUID itemId, DraftItemRequest request) {
        requireReviewable(load(restaurantId, uploadId));
        MenuDraftItem item = draftRepository.findByIdAndUploadIdAndRestaurantId(itemId, uploadId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Draft item"));
        // Saving a row means the owner reviewed it; only a still-missing price remains flagged.
        List<String> stillUncertain = request.price() == null ? new ArrayList<>(List.of("price")) : new ArrayList<>();
        apply(item, request);
        item.setUncertainFields(stillUncertain);
        return toResponse(draftRepository.saveAndFlush(item));
    }

    @Override
    @Transactional
    public DraftItemResponse addItem(UUID restaurantId, UUID uploadId, DraftItemRequest request) {
        requireReviewable(load(restaurantId, uploadId));
        MenuDraftItem item = new MenuDraftItem();
        item.setUploadId(uploadId);
        item.setRestaurantId(restaurantId);
        item.setConfidence(BigDecimal.ONE);
        item.setSortOrder(draftRepository.maxSortOrder(uploadId) + 1);
        apply(item, request);
        return toResponse(draftRepository.save(item));
    }

    @Override
    @Transactional
    public void deleteItem(UUID restaurantId, UUID uploadId, UUID itemId) {
        requireReviewable(load(restaurantId, uploadId));
        MenuDraftItem item = draftRepository.findByIdAndUploadIdAndRestaurantId(itemId, uploadId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Draft item"));
        draftRepository.delete(item);
    }

    @Override
    @Transactional
    public PublishResponse publish(UUID restaurantId, UUID uploadId) {
        MenuUpload upload = load(restaurantId, uploadId);
        requireReviewable(upload);
        List<MenuDraftItem> included = draftRepository.findAllByUploadIdOrderBySortOrderAsc(uploadId).stream()
                .filter(MenuDraftItem::isIncluded).toList();
        if (included.isEmpty()) {
            throw new BusinessRuleException("NOTHING_TO_PUBLISH", "Select at least one item to publish");
        }
        long missingPrice = included.stream().filter(i -> i.getPrice() == null).count();
        if (missingPrice > 0) {
            throw new BusinessRuleException("MISSING_PRICES",
                    missingPrice + (missingPrice == 1 ? " item is" : " items are") + " missing a price. Add prices or exclude them.");
        }
        MenuImportResult result = menuService.importItems(restaurantId, included.stream()
                .map(i -> new MenuImportItem(i.getCategoryName(), i.getName(), i.getDescription(), i.getPrice(), i.getDietary()))
                .toList());
        upload.setStatus(MenuUploadStatus.PUBLISHED);
        upload.setPublishedAt(clock.instant());
        upload.setPublishedItemCount(result.itemsCreated());
        return new PublishResponse(result.itemsCreated(), result.categoriesCreated());
    }

    @Override
    @Transactional
    public void discard(UUID restaurantId, UUID uploadId) {
        MenuUpload upload = load(restaurantId, uploadId);
        if (upload.getStatus() == MenuUploadStatus.PUBLISHED) {
            throw new ConflictException("ALREADY_PUBLISHED", "This menu has already been published");
        }
        upload.setStatus(MenuUploadStatus.DISCARDED);
    }

    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public void runExtraction(UUID uploadId) {
        MenuUpload upload = uploadRepository.findById(uploadId).orElse(null);
        if (upload == null || upload.getStatus() != MenuUploadStatus.PROCESSING) {
            return;
        }
        try {
            String restaurantName = restaurantService.get(upload.getRestaurantId()).name();
            ExtractionResult result = extractionProvider.extract(new ExtractionInput(upload.getFileKey(),
                    upload.getContentType(), upload.getOriginalFilename(), restaurantName));
            transactionTemplate.executeWithoutResult(tx -> {
                MenuUpload fresh = uploadRepository.findById(uploadId).orElseThrow();
                int order = 0;
                for (ExtractedItem extracted : result.items()) {
                    MenuDraftItem item = new MenuDraftItem();
                    item.setUploadId(uploadId);
                    item.setRestaurantId(fresh.getRestaurantId());
                    item.setCategoryName(extracted.categoryName());
                    item.setName(extracted.name());
                    item.setDescription(extracted.description());
                    item.setPrice(extracted.price());
                    item.setDietary(extracted.dietary());
                    item.setConfidence(BigDecimal.valueOf(extracted.confidence()).setScale(2, RoundingMode.HALF_UP));
                    item.setUncertainFields(new ArrayList<>(extracted.uncertainFields()));
                    item.setSortOrder(++order);
                    draftRepository.save(item);
                }
                fresh.setExtractionProvider(result.provider());
                fresh.setStatus(MenuUploadStatus.READY_FOR_REVIEW);
            });
            log.info("Extracted {} items from menu upload {}", result.items().size(), uploadId);
        } catch (RuntimeException e) {
            log.error("Menu extraction failed for upload {}", uploadId, e);
            transactionTemplate.executeWithoutResult(tx -> uploadRepository.findById(uploadId).ifPresent(u -> {
                u.setStatus(MenuUploadStatus.FAILED);
                u.setErrorMessage("We couldn't read this menu. Try a clearer photo or a PDF.");
            }));
        }
    }

    // ------------------------------------------------------------------

    private static void apply(MenuDraftItem item, DraftItemRequest request) {
        item.setCategoryName(request.categoryName().trim());
        item.setName(request.name().trim());
        item.setDescription(request.description() == null || request.description().isBlank() ? null : request.description().trim());
        item.setPrice(request.price());
        item.setDietary(request.dietary());
        item.setIncluded(request.included());
    }

    private static void requireReviewable(MenuUpload upload) {
        if (upload.getStatus() != MenuUploadStatus.READY_FOR_REVIEW) {
            throw new ConflictException("NOT_REVIEWABLE", switch (upload.getStatus()) {
                case PROCESSING -> "This menu is still being processed";
                case PUBLISHED -> "This menu has already been published";
                case DISCARDED -> "This upload was discarded";
                default -> "This upload can't be edited";
            });
        }
    }

    private MenuUpload load(UUID restaurantId, UUID uploadId) {
        return uploadRepository.findByIdAndRestaurantId(uploadId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Menu upload"));
    }

    private static DraftItemResponse toResponse(MenuDraftItem d) {
        return new DraftItemResponse(d.getId(), d.getCategoryName(), d.getName(), d.getDescription(), d.getPrice(),
                d.getDietary(), d.getConfidence(), List.copyOf(d.getUncertainFields()), d.isIncluded(), d.getSortOrder());
    }

    private static MenuUploadResponse toResponse(MenuUpload u, List<MenuDraftItem> items, boolean includeItems) {
        int uncertain = (int) items.stream().filter(i -> !i.getUncertainFields().isEmpty()).count();
        return new MenuUploadResponse(u.getId(), u.getOriginalFilename(), u.getContentType(), u.getFileSize(),
                u.getFileUrl(), u.getStatus(), u.getExtractionProvider(), u.getErrorMessage(), items.size(), uncertain,
                u.getPublishedItemCount(), u.getPublishedAt(), u.getCreatedAt(),
                includeItems ? items.stream().map(MenuOnboardingServiceImpl::toResponse).toList() : null);
    }
}
