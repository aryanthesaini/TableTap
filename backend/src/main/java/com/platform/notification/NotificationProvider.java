package com.platform.notification;

/** Outbound notifications (WhatsApp/SMS/push in production). */
public interface NotificationProvider {

    void send(Notification notification);
}
