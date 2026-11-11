package com.platform.payment;

import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Fails payments that never completed (e.g. customer closed the checkout, bank timed out). */
@Slf4j
@Component
public class PaymentExpiryJob {

    private final PaymentService paymentService;

    public PaymentExpiryJob(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @Scheduled(fixedDelayString = "PT1M", initialDelayString = "PT30S")
    public void expireStalePayments() {
        int expired = paymentService.expireStalePayments();
        if (expired > 0) {
            log.info("Expired {} stale payment(s)", expired);
        }
    }
}
