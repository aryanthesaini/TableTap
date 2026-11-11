package com.platform.payment;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Provider → platform callbacks. Each restaurant registers its own URL (with its restaurant id)
 * in its merchant dashboard, so the matching webhook secret can be selected for verification.
 */
@Tag(name = "Payment webhooks")
@RestController
@RequestMapping("/api/v1/webhooks/payments")
public class PaymentWebhookController {

    private final PaymentService paymentService;

    public PaymentWebhookController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @Operation(summary = "Receive a payment event (HMAC-SHA256 of the raw body in X-Razorpay-Signature)")
    @PostMapping("/{provider}/{restaurantId}")
    public ResponseEntity<Void> receive(@PathVariable String provider,
                                        @PathVariable UUID restaurantId,
                                        @RequestHeader(name = "X-Razorpay-Signature", required = false) String signature,
                                        @RequestBody String payload) {
        paymentService.handleWebhook(provider, restaurantId, payload, signature);
        return ResponseEntity.ok().build();
    }
}
