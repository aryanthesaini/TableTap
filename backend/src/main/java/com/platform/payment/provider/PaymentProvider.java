package com.platform.payment.provider;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * Payment gateway adapter. Modelled on Razorpay's server-side flow:
 * <ol>
 *     <li>{@link #createOrder} — server creates an order; the browser opens the provider checkout for it</li>
 *     <li>the provider's checkout returns {@code payment_id + signature} to the browser, which forwards them</li>
 *     <li>{@link #verifyPaymentSignature} + {@link #fetchPayment} — the server verifies and asks the
 *         provider for the authoritative status (never trusting the browser)</li>
 *     <li>{@link #verifyWebhookSignature} / {@link #parseWebhook} — asynchronous confirmation</li>
 * </ol>
 * All calls take the restaurant's own credentials: each restaurant is its own merchant.
 */
public interface PaymentProvider {

    /** Stored in {@code payment.provider}, e.g. {@code MOCK} or {@code RAZORPAY}. */
    String code();

    ProviderOrder createOrder(MerchantCredentials credentials, BigDecimal amount, String currency, String receipt);

    boolean verifyPaymentSignature(MerchantCredentials credentials, String providerOrderId,
                                   String providerPaymentId, String signature);

    ProviderPayment fetchPayment(MerchantCredentials credentials, String providerPaymentId);

    /** Latest payment attempt for an order (used for reconciliation when the browser never reported back). */
    Optional<ProviderPayment> fetchLatestPaymentForOrder(MerchantCredentials credentials, String providerOrderId);

    boolean verifyWebhookSignature(MerchantCredentials credentials, String payload, String signature);

    ProviderWebhookEvent parseWebhook(String payload);

    /** Validates credentials when a restaurant connects its account. Throws IllegalArgumentException if invalid. */
    void validateCredentials(MerchantCredentials credentials);
}
