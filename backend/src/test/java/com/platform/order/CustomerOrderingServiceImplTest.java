package com.platform.order;

import com.platform.TestFixtures;
import com.platform.common.error.ApiException;
import com.platform.common.error.BusinessRuleException;
import com.platform.menu.Dietary;
import com.platform.menu.MenuService;
import com.platform.menu.dto.MenuItemResponse;
import com.platform.order.dto.CheckoutResponse;
import com.platform.order.dto.StartCheckoutRequest;
import com.platform.payment.PaymentService;
import com.platform.payment.dto.InitiatePaymentCommand;
import com.platform.payment.dto.PaymentInitiation;
import com.platform.restaurant.RestaurantService;
import com.platform.table.TableService;
import com.platform.table.dto.TableRef;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomerOrderingServiceImplTest {

    private static final UUID RESTAURANT = UUID.randomUUID();
    private static final UUID TABLE = UUID.randomUUID();
    private static final String SLUG = "test-kitchen";
    private static final String TOKEN = "tok123456789";

    @Mock RestaurantService restaurantService;
    @Mock TableService tableService;
    @Mock MenuService menuService;
    @Mock PaymentService paymentService;
    @Mock CheckoutSessionRepository checkoutRepository;
    @Mock CustomerOrderRepository orderRepository;

    CustomerOrderingServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new CustomerOrderingServiceImpl(restaurantService, tableService, menuService, paymentService,
                checkoutRepository, orderRepository);
    }

    private void givenOpenTableAndRestaurant() {
        when(tableService.findByQrToken(TOKEN)).thenReturn(Optional.of(new TableRef(TABLE, RESTAURANT, "Table 4", true)));
        when(restaurantService.get(RESTAURANT)).thenReturn(TestFixtures.restaurant(RESTAURANT, SLUG));
    }

    private static MenuItemResponse item(UUID id, String name, String price, boolean available) {
        return new MenuItemResponse(id, UUID.randomUUID(), name, null, new BigDecimal(price), null, available,
                Dietary.VEG, false, 1, Instant.now());
    }

    @Test
    void pricesCartOnServerMergesDuplicatesAndAddsTax() {
        givenOpenTableAndRestaurant();
        when(paymentService.isAcceptingPayments(RESTAURANT)).thenReturn(true);
        UUID naan = UUID.randomUUID();
        UUID dal = UUID.randomUUID();
        when(menuService.findItems(eq(RESTAURANT), anyCollection()))
                .thenReturn(List.of(item(naan, "Butter Naan", "80.00", true), item(dal, "Dal Makhani", "360.00", true)));
        when(checkoutRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(paymentService.initiate(any())).thenReturn(new PaymentInitiation(UUID.randomUUID(), "MOCK", "rzp_test_x",
                "order_x", new BigDecimal("546.00"), 54600, "INR"));

        CheckoutResponse response = service.startCheckout(new StartCheckoutRequest(SLUG, TOKEN, List.of(
                new StartCheckoutRequest.CartLine(naan, 1),
                new StartCheckoutRequest.CartLine(dal, 1),
                new StartCheckoutRequest.CartLine(naan, 1)), "  less spicy  "));

        assertThat(response.items()).hasSize(2);
        assertThat(response.items().get(0).quantity()).isEqualTo(2);
        assertThat(response.subtotal()).isEqualByComparingTo("520.00");
        assertThat(response.taxAmount()).isEqualByComparingTo("26.00");
        assertThat(response.totalAmount()).isEqualByComparingTo("546.00");

        ArgumentCaptor<InitiatePaymentCommand> payment = ArgumentCaptor.forClass(InitiatePaymentCommand.class);
        verify(paymentService).initiate(payment.capture());
        assertThat(payment.getValue().amount()).isEqualByComparingTo("546.00");
        assertThat(payment.getValue().restaurantId()).isEqualTo(RESTAURANT);

        ArgumentCaptor<CheckoutSession> session = ArgumentCaptor.forClass(CheckoutSession.class);
        verify(checkoutRepository).save(session.capture());
        assertThat(session.getValue().getCustomerNote()).isEqualTo("less spicy");
        // No order exists before payment.
        verify(orderRepository, never()).save(any());
    }

    @Test
    void rejectsUnavailableItem() {
        givenOpenTableAndRestaurant();
        when(paymentService.isAcceptingPayments(RESTAURANT)).thenReturn(true);
        UUID id = UUID.randomUUID();
        when(menuService.findItems(eq(RESTAURANT), anyCollection())).thenReturn(List.of(item(id, "Palak Paneer", "340", false)));

        assertThatThrownBy(() -> service.startCheckout(new StartCheckoutRequest(SLUG, TOKEN,
                List.of(new StartCheckoutRequest.CartLine(id, 1)), null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("sold out");
        verify(paymentService, never()).initiate(any());
    }

    @Test
    void rejectsItemThatDoesNotBelongToThisRestaurant() {
        givenOpenTableAndRestaurant();
        when(paymentService.isAcceptingPayments(RESTAURANT)).thenReturn(true);
        // findItems is tenant-scoped, so another restaurant's item simply isn't returned
        when(menuService.findItems(eq(RESTAURANT), anyCollection())).thenReturn(List.of());

        assertThatThrownBy(() -> service.startCheckout(new StartCheckoutRequest(SLUG, TOKEN,
                List.of(new StartCheckoutRequest.CartLine(UUID.randomUUID(), 1)), null)))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("ITEM_NOT_FOUND");
    }

    @Test
    void rejectsTokenUsedUnderAnotherRestaurantsSlug() {
        givenOpenTableAndRestaurant();

        assertThatThrownBy(() -> service.getStorefront("some-other-restaurant", TOKEN))
                .isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("TABLE_NOT_FOUND");
    }

    @Test
    void blocksCheckoutOnInactiveTable() {
        when(tableService.findByQrToken(TOKEN)).thenReturn(Optional.of(new TableRef(TABLE, RESTAURANT, "Table 4", false)));
        when(restaurantService.get(RESTAURANT)).thenReturn(TestFixtures.restaurant(RESTAURANT, SLUG));

        assertThatThrownBy(() -> service.startCheckout(new StartCheckoutRequest(SLUG, TOKEN,
                List.of(new StartCheckoutRequest.CartLine(UUID.randomUUID(), 1)), null)))
                .isInstanceOf(BusinessRuleException.class)
                .extracting("code").isEqualTo("ORDERING_UNAVAILABLE");
    }

    @Test
    void blocksCheckoutWhenRestaurantPausedOrdering() {
        when(tableService.findByQrToken(TOKEN)).thenReturn(Optional.of(new TableRef(TABLE, RESTAURANT, "Table 4", true)));
        when(restaurantService.get(RESTAURANT)).thenReturn(
                TestFixtures.restaurant(RESTAURANT, SLUG, com.platform.restaurant.RestaurantStatus.ACTIVE, false));

        assertThatThrownBy(() -> service.startCheckout(new StartCheckoutRequest(SLUG, TOKEN,
                List.of(new StartCheckoutRequest.CartLine(UUID.randomUUID(), 1)), null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("isn't taking online orders");
    }
}
