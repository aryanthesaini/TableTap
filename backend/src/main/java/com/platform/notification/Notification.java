package com.platform.notification;

import java.util.UUID;

public record Notification(UUID restaurantId, Channel channel, String title, String body) {

    public enum Channel { DASHBOARD, SMS, WHATSAPP, EMAIL }
}
