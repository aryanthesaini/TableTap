package com.platform.payment;

import com.platform.common.web.PageResponse;
import com.platform.payment.dto.ClientPaymentConfirmation;
import com.platform.payment.dto.InitiatePaymentCommand;
import com.platform.payment.dto.PaymentConfigurationResponse;
import com.platform.payment.dto.PaymentInitiation;
import com.platform.payment.dto.PaymentSummary;
import com.platform.payment.dto.PaymentView;
import com.platform.payment.dto.UpdatePaymentConfigurationRequest;

import java.util.Optional;
import java.util.UUID;

/**
 * Payment lifecycle, independent of orders. Outcomes are announced through
 * {@link PaymentCapturedEvent} / {@link PaymentFailedEvent}.
 */
public interface PaymentService {

    boolean isAcceptingPayments(UUID restaurantId);

    PaymentInitiation initiate(InitiatePaymentCommand command);

    /** Verifies the browser-reported result against the provider and updates the payment. Idempotent. */
    PaymentView confirm(UUID paymentId, ClientPaymentConfirmation confirmation);

    /** Pulls the authoritative state from the provider (no browser input). Idempotent. */
    PaymentView reconcile(UUID paymentId);

    Optional<PaymentView> findLatestForCheckout(UUID checkoutSessionId);

    void handleWebhook(String provider, UUID restaurantId, String payload, String signature);

    void linkOrder(UUID paymentId, UUID orderId, int orderNumber);

    /** Marks CREATED/PENDING payments older than the configured timeout as FAILED. Returns how many. */
    int expireStalePayments();

    PageResponse<PaymentView> list(UUID restaurantId, PaymentStatus status, int page, int size);

    PaymentSummary summary(UUID restaurantId, int days);

    PaymentConfigurationResponse getConfiguration(UUID restaurantId);

    PaymentConfigurationResponse updateConfiguration(UUID restaurantId, UpdatePaymentConfigurationRequest request);
}
