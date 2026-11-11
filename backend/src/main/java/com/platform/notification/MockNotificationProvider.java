package com.platform.notification;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/** Logs notifications instead of sending them. The dashboard itself polls for new orders. */
@Slf4j
@Component
public class MockNotificationProvider implements NotificationProvider {

    @Override
    public void send(Notification notification) {
        log.info("[notification:{}] restaurant={} | {} — {}", notification.channel(), notification.restaurantId(),
                notification.title(), notification.body());
    }
}
