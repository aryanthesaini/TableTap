package com.platform.order;

import com.platform.common.error.NotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrderServiceImplTest {

    @Mock CustomerOrderRepository repository;

    Clock clock = Clock.fixed(Instant.parse("2026-11-11T14:00:00Z"), ZoneOffset.UTC);

    private OrderServiceImpl service() {
        return new OrderServiceImpl(repository, clock, ZoneId.of("Asia/Kolkata"));
    }

    private static CustomerOrder pendingOrder() {
        CustomerOrder o = new CustomerOrder();
        o.setStatus(OrderStatus.PENDING);
        o.setCurrency("INR");
        o.setSubtotal(BigDecimal.TEN);
        o.setTaxAmount(BigDecimal.ONE);
        o.setTotalAmount(BigDecimal.valueOf(11));
        o.setTableName("Table 1");
        return o;
    }

    @Test
    void markServedSetsTimestampAndIsIdempotent() {
        UUID restaurant = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        UUID staff = UUID.randomUUID();
        CustomerOrder order = pendingOrder();
        when(repository.findByIdAndRestaurantId(orderId, restaurant)).thenReturn(Optional.of(order));
        when(repository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));

        service().markServed(restaurant, orderId, staff);
        Instant firstServedAt = order.getServedAt();
        service().markServed(restaurant, orderId, UUID.randomUUID());

        assertThat(order.getStatus()).isEqualTo(OrderStatus.SERVED);
        assertThat(firstServedAt).isEqualTo(clock.instant());
        assertThat(order.getServedBy()).isEqualTo(staff);
    }

    @Test
    void cannotTouchAnotherRestaurantsOrder() {
        UUID otherRestaurant = UUID.randomUUID();
        UUID orderId = UUID.randomUUID();
        when(repository.findByIdAndRestaurantId(orderId, otherRestaurant)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service().markServed(otherRestaurant, orderId, UUID.randomUUID()))
                .isInstanceOf(NotFoundException.class);
    }
}
