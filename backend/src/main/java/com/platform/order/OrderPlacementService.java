package com.platform.order;

import com.platform.common.error.NotFoundException;
import com.platform.payment.PaymentCapturedEvent;
import com.platform.payment.PaymentFailedEvent;
import com.platform.payment.PaymentService;
import com.platform.payment.PaymentStatus;
import com.platform.restaurant.RestaurantService;
import com.platform.table.TableService;
import com.platform.table.dto.TableRef;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turns captured payments into orders. Runs synchronously inside the payment-capturing transaction,
 * so "payment captured" and "order created" commit (or roll back) together.
 */
@Slf4j
@Service
public class OrderPlacementService {

    private final CheckoutSessionRepository checkoutRepository;
    private final CustomerOrderRepository orderRepository;
    private final RestaurantService restaurantService;
    private final TableService tableService;
    private final PaymentService paymentService;
    private final ApplicationEventPublisher events;

    public OrderPlacementService(CheckoutSessionRepository checkoutRepository, CustomerOrderRepository orderRepository,
                                 RestaurantService restaurantService, TableService tableService,
                                 PaymentService paymentService, ApplicationEventPublisher events) {
        this.checkoutRepository = checkoutRepository;
        this.orderRepository = orderRepository;
        this.restaurantService = restaurantService;
        this.tableService = tableService;
        this.paymentService = paymentService;
        this.events = events;
    }

    @EventListener
    @Transactional(propagation = Propagation.MANDATORY)
    public void onPaymentCaptured(PaymentCapturedEvent event) {
        CheckoutSession session = checkoutRepository.findByIdForUpdate(event.checkoutSessionId())
                .orElseThrow(() -> new NotFoundException("Checkout"));
        if (orderRepository.existsByCheckoutSessionId(session.getId())) {
            log.info("Order for checkout {} already exists; ignoring duplicate capture", session.getId());
            return;
        }
        if (session.getTotalAmount().compareTo(event.amount()) != 0) {
            // Should be impossible (payment is created from the session total) — fail loudly rather than mis-bill.
            throw new IllegalStateException("Captured amount does not match checkout " + session.getId());
        }
        // Money has been taken: the order is created even if the checkout had already expired.
        String tableName = tableService.find(session.getRestaurantId(), session.getTableId())
                .map(TableRef::name).orElse("Table");

        CustomerOrder order = new CustomerOrder();
        order.setRestaurantId(session.getRestaurantId());
        order.setTableId(session.getTableId());
        order.setTableName(tableName);
        order.setOrderNumber(restaurantService.nextOrderNumber(session.getRestaurantId()));
        order.setCheckoutSessionId(session.getId());
        order.setStatus(OrderStatus.PENDING);
        order.setPaymentStatus(PaymentStatus.CAPTURED);
        order.setCurrency(session.getCurrency());
        order.setSubtotal(session.getSubtotal());
        order.setTaxAmount(session.getTaxAmount());
        order.setTotalAmount(session.getTotalAmount());
        order.setCustomerNote(session.getCustomerNote());
        for (CheckoutLine line : session.getItems()) {
            OrderItem item = new OrderItem();
            item.setMenuItemId(line.menuItemId());
            item.setItemName(line.name());
            item.setUnitPrice(line.unitPrice());
            item.setQuantity(line.quantity());
            item.setLineTotal(line.lineTotal());
            item.setDietary(line.dietary());
            order.addItem(item);
        }
        order = orderRepository.save(order);
        session.setStatus(CheckoutStatus.COMPLETED);

        paymentService.linkOrder(event.paymentId(), order.getId(), order.getOrderNumber());
        int itemCount = order.getItems().stream().mapToInt(OrderItem::getQuantity).sum();
        events.publishEvent(new OrderPlacedEvent(order.getId(), order.getRestaurantId(), order.getOrderNumber(),
                tableName, order.getTotalAmount(), order.getCurrency().trim(), itemCount));
        log.info("Order #{} placed for restaurant {} (checkout {})", order.getOrderNumber(), order.getRestaurantId(), session.getId());
    }

    @EventListener
    @Transactional(propagation = Propagation.MANDATORY)
    public void onPaymentFailed(PaymentFailedEvent event) {
        checkoutRepository.findByIdForUpdate(event.checkoutSessionId())
                .filter(s -> s.getStatus() == CheckoutStatus.OPEN)
                .ifPresent(s -> s.setStatus("Payment timed out".equals(event.reason()) ? CheckoutStatus.EXPIRED : CheckoutStatus.FAILED));
    }
}
