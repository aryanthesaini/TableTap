package com.platform.menuai;

import com.platform.common.error.BusinessRuleException;
import com.platform.common.error.ConflictException;
import com.platform.menu.MenuService;
import com.platform.menu.dto.MenuImportResult;
import com.platform.menuai.provider.MockMenuExtractionProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MenuOnboardingServiceImplTest {

    @Mock MenuUploadRepository uploadRepository;
    @Mock MenuDraftItemRepository draftRepository;
    @Mock MenuService menuService;

    private final UUID restaurant = UUID.randomUUID();
    private final UUID uploadId = UUID.randomUUID();

    private MenuOnboardingServiceImpl service() {
        return new MenuOnboardingServiceImpl(uploadRepository, draftRepository, new MockMenuExtractionProvider(),
                null, menuService, null, null, null, null, Clock.systemUTC());
    }

    private MenuUpload upload(MenuUploadStatus status) {
        MenuUpload u = new MenuUpload();
        u.setRestaurantId(restaurant);
        u.setStatus(status);
        when(uploadRepository.findByIdAndRestaurantId(uploadId, restaurant)).thenReturn(Optional.of(u));
        return u;
    }

    private static MenuDraftItem draft(String name, String price, boolean included) {
        MenuDraftItem d = new MenuDraftItem();
        d.setCategoryName("Tiffin");
        d.setName(name);
        d.setPrice(price == null ? null : new BigDecimal(price));
        d.setIncluded(included);
        return d;
    }

    @Test
    void publishRequiresPricesOnIncludedItems() {
        upload(MenuUploadStatus.READY_FOR_REVIEW);
        when(draftRepository.findAllByUploadIdOrderBySortOrderAsc(uploadId))
                .thenReturn(List.of(draft("Masala Dosa", "140", true), draft("Pongal", null, true)));

        assertThatThrownBy(() -> service().publish(restaurant, uploadId))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("1 item is missing a price");
        verify(menuService, never()).importItems(any(), any());
    }

    @Test
    void publishImportsOnlyIncludedItemsAndMarksUploadPublished() {
        MenuUpload upload = upload(MenuUploadStatus.READY_FOR_REVIEW);
        when(draftRepository.findAllByUploadIdOrderBySortOrderAsc(uploadId))
                .thenReturn(List.of(draft("Masala Dosa", "140", true), draft("Pongal", null, false)));
        when(menuService.importItems(eq(restaurant), any())).thenReturn(new MenuImportResult(1, 1));

        var result = service().publish(restaurant, uploadId);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<com.platform.menu.dto.MenuImportItem>> captor = ArgumentCaptor.forClass(List.class);
        verify(menuService).importItems(eq(restaurant), captor.capture());
        assertThat(captor.getValue()).extracting("name").containsExactly("Masala Dosa");
        assertThat(result.itemsCreated()).isEqualTo(1);
        assertThat(upload.getStatus()).isEqualTo(MenuUploadStatus.PUBLISHED);
    }

    @Test
    void cannotPublishTwice() {
        upload(MenuUploadStatus.PUBLISHED);
        assertThatThrownBy(() -> service().publish(restaurant, uploadId)).isInstanceOf(ConflictException.class);
    }

    @Test
    void mockExtractorFlagsUncertainFields() {
        var result = new MockMenuExtractionProvider().extract(null);
        assertThat(result.items()).hasSizeGreaterThan(10);
        assertThat(result.items()).anyMatch(i -> i.uncertainFields().contains("price") && i.price() == null);
    }
}
