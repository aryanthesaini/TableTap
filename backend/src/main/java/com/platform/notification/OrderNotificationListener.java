package com.platform.notification;

import com.platform.order.OrderPlacedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/** Notifies the restaurant about new orders — only after the order has been committed. */
@Slf4j
@Component
public class OrderNotificationListener {

    private final NotificationProvider notificationProvider;

    public OrderNotificationListener(NotificationProvider notificationProvider) {
        this.notificationProvider = notificationProvider;
    }

    @Async
    @TransactionalEventListener
    public void onOrderPlaced(OrderPlacedEvent event) {
        try {
            notificationProvider.send(new Notification(event.restaurantId(), Notification.Channel.WHATSAPP,
                    "New order #" + event.orderNumber(),
                    event.tableName() + " · " + event.itemCount() + " item(s) · " + event.currency() + " " + event.totalAmount()));
        } catch (RuntimeException e) {
            log.warn("Notification for order {} failed: {}", event.orderId(), e.getMessage());
        }
    }
}
