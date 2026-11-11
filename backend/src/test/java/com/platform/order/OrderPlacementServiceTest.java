package com.platform.order;

import com.platform.payment.PaymentCapturedEvent;
import com.platform.payment.PaymentService;
import com.platform.payment.PaymentStatus;
import com.platform.restaurant.RestaurantService;
import com.platform.table.TableService;
import com.platform.table.dto.TableRef;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
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
class OrderPlacementServiceTest {

    @Mock CheckoutSessionRepository checkoutRepository;
    @Mock CustomerOrderRepository orderRepository;
    @Mock RestaurantService restaurantService;
    @Mock TableService tableService;
    @Mock PaymentService paymentService;
    @Mock ApplicationEventPublisher events;
    @InjectMocks OrderPlacementService service;

    private CheckoutSession session(UUID restaurantId, UUID tableId) {
        CheckoutSession s = new CheckoutSession();
        s.setRestaurantId(restaurantId);
        s.setTableId(tableId);
        s.setCurrency("INR");
        s.setSubtotal(new BigDecimal("520.00"));
        s.setTaxAmount(new BigDecimal("26.00"));
        s.setTotalAmount(new BigDecimal("546.00"));
        s.setCustomerNote("No onions");
        s.setItems(List.of(
                new CheckoutLine(UUID.randomUUID(), "Butter Naan", new BigDecimal("80.00"), 2, new BigDecimal("160.00"), "VEG"),
                new CheckoutLine(UUID.randomUUID(), "Dal Makhani", new BigDecimal("360.00"), 1, new BigDecimal("360.00"), "VEG")));
        return s;
    }

    @Test
    void capturedPaymentCreatesPendingOrderWithSnapshots() {
        UUID restaurant = UUID.randomUUID();
        UUID table = UUID.randomUUID();
        UUID checkoutId = UUID.randomUUID();
        UUID paymentId = UUID.randomUUID();
        CheckoutSession session = session(restaurant, table);
        when(checkoutRepository.findByIdForUpdate(checkoutId)).thenReturn(Optional.of(session));
        when(orderRepository.existsByCheckoutSessionId(any())).thenReturn(false);
        when(tableService.find(restaurant, table)).thenReturn(Optional.of(new TableRef(table, restaurant, "Table 4", true)));
        when(restaurantService.nextOrderNumber(restaurant)).thenReturn(1043);
        when(orderRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.onPaymentCaptured(new PaymentCapturedEvent(paymentId, restaurant, checkoutId, new BigDecimal("546.00"), "UPI"));

        ArgumentCaptor<CustomerOrder> captor = ArgumentCaptor.forClass(CustomerOrder.class);
        verify(orderRepository).save(captor.capture());
        CustomerOrder order = captor.getValue();
        assertThat(order.getOrderNumber()).isEqualTo(1043);
        assertThat(order.getStatus()).isEqualTo(OrderStatus.PENDING);
        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.CAPTURED);
        assertThat(order.getTableName()).isEqualTo("Table 4");
        assertThat(order.getTotalAmount()).isEqualByComparingTo("546.00");
        assertThat(order.getItems()).extracting(OrderItem::getItemName).containsExactly("Butter Naan", "Dal Makhani");
        assertThat(order.getItems().get(0).getUnitPrice()).isEqualByComparingTo("80.00");
        assertThat(order.getItems().get(0).getQuantity()).isEqualTo(2);
        assertThat(session.getStatus()).isEqualTo(CheckoutStatus.COMPLETED);
        verify(paymentService).linkOrder(eq(paymentId), any(), eq(1043));
        verify(events).publishEvent(any(OrderPlacedEvent.class));
    }

    @Test
    void duplicateCaptureDoesNotCreateSecondOrder() {
        UUID checkoutId = UUID.randomUUID();
        when(checkoutRepository.findByIdForUpdate(checkoutId)).thenReturn(Optional.of(session(UUID.randomUUID(), UUID.randomUUID())));
        when(orderRepository.existsByCheckoutSessionId(any())).thenReturn(true);

        service.onPaymentCaptured(new PaymentCapturedEvent(UUID.randomUUID(), UUID.randomUUID(), checkoutId, new BigDecimal("546.00"), "UPI"));

        verify(orderRepository, never()).save(any());
        verify(restaurantService, never()).nextOrderNumber(any());
    }

    @Test
    void amountMismatchNeverCreatesOrder() {
        UUID checkoutId = UUID.randomUUID();
        when(checkoutRepository.findByIdForUpdate(checkoutId)).thenReturn(Optional.of(session(UUID.randomUUID(), UUID.randomUUID())));

        assertThatThrownBy(() -> service.onPaymentCaptured(new PaymentCapturedEvent(UUID.randomUUID(), UUID.randomUUID(),
                checkoutId, new BigDecimal("1.00"), "UPI"))).isInstanceOf(IllegalStateException.class);
        verify(orderRepository, never()).save(any());
    }
}
