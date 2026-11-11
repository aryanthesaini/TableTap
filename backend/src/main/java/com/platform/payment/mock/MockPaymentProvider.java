package com.platform.payment.mock;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.platform.common.util.SecureTokens;
import com.platform.payment.provider.HmacSigner;
import com.platform.payment.provider.MerchantCredentials;
import com.platform.payment.provider.PaymentProvider;
import com.platform.payment.provider.ProviderOrder;
import com.platform.payment.provider.ProviderPayment;
import com.platform.payment.provider.ProviderPaymentStatus;
import com.platform.payment.provider.ProviderWebhookEvent;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * In-memory stand-in for Razorpay. It behaves like the real gateway from the backend's point of
 * view — orders, HMAC payment signatures ({@code order_id|payment_id} signed with the key secret),
 * server-side payment lookup and signed webhooks — so swapping in a real {@code RazorpayPaymentProvider}
 * requires no changes elsewhere.
 * <p>
 * Gateway state lives in memory (it simulates an external system); restarting the backend forgets
 * in-flight mock payments, which the expiry job then marks as failed.
 */
@Component
@ConditionalOnProperty(name = "app.payments.provider", havingValue = "mock", matchIfMissing = true)
public class MockPaymentProvider implements PaymentProvider {

    public static final String CODE = "MOCK";
    private static final Pattern KEY_ID = Pattern.compile("^rzp_(test|live)_[A-Za-z0-9]{6,}$");

    public enum Outcome { SUCCESS, FAILURE, TIMEOUT }

    private final ObjectMapper objectMapper;
    private final Map<String, MockOrder> orders = new ConcurrentHashMap<>();
    private final Map<String, ProviderPayment> payments = new ConcurrentHashMap<>();

    public MockPaymentProvider(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public String code() {
        return CODE;
    }

    @Override
    public ProviderOrder createOrder(MerchantCredentials credentials, BigDecimal amount, String currency, String receipt) {
        validateCredentials(credentials);
        long amountMinor = amount.movePointRight(2).setScale(0, RoundingMode.UNNECESSARY).longValueExact();
        String id = "order_" + SecureTokens.base62(14);
        orders.put(id, new MockOrder(id, amountMinor, currency, credentials, receipt, new ArrayList<>()));
        return new ProviderOrder(id, amountMinor, currency);
    }

    @Override
    public boolean verifyPaymentSignature(MerchantCredentials credentials, String providerOrderId,
                                          String providerPaymentId, String signature) {
        return HmacSigner.verify(providerOrderId + "|" + providerPaymentId, credentials.keySecret(), signature);
    }

    @Override
    public ProviderPayment fetchPayment(MerchantCredentials credentials, String providerPaymentId) {
        ProviderPayment payment = payments.get(providerPaymentId);
        if (payment == null || !ownedBy(payment.providerOrderId(), credentials)) {
            throw new IllegalArgumentException("Payment " + providerPaymentId + " not found at provider");
        }
        return payment;
    }

    @Override
    public Optional<ProviderPayment> fetchLatestPaymentForOrder(MerchantCredentials credentials, String providerOrderId) {
        MockOrder order = orders.get(providerOrderId);
        if (order == null || !ownedBy(providerOrderId, credentials) || order.paymentIds().isEmpty()) {
            return Optional.empty();
        }
        return Optional.ofNullable(payments.get(order.paymentIds().get(order.paymentIds().size() - 1)));
    }

    @Override
    public boolean verifyWebhookSignature(MerchantCredentials credentials, String payload, String signature) {
        return HmacSigner.verify(payload, credentials.webhookSecret(), signature);
    }

    @Override
    public ProviderWebhookEvent parseWebhook(String payload) {
        try {
            JsonNode root = objectMapper.readTree(payload);
            JsonNode entity = root.path("payload").path("payment").path("entity");
            return new ProviderWebhookEvent(root.path("id").asText(), root.path("event").asText(),
                    entity.path("order_id").asText(null), entity.path("id").asText(null));
        } catch (Exception e) {
            throw new IllegalArgumentException("Malformed webhook payload", e);
        }
    }

    @Override
    public void validateCredentials(MerchantCredentials credentials) {
        if (credentials.keyId() == null || !KEY_ID.matcher(credentials.keyId()).matches()) {
            throw new IllegalArgumentException("Key ID must look like rzp_test_XXXXXX or rzp_live_XXXXXX");
        }
        if (credentials.keyId().startsWith("rzp_live_") != credentials.liveMode()) {
            throw new IllegalArgumentException("Key ID does not match the selected mode (test/live)");
        }
        if (credentials.keySecret() == null || credentials.keySecret().length() < 8) {
            throw new IllegalArgumentException("Key secret looks invalid");
        }
    }

    // ------------------------------------------------------------------ simulation API (mock only)

    /** What the hosted checkout hands back to the browser. */
    public record SimulationResult(Outcome outcome, String providerOrderId, String providerPaymentId,
                                   String signature, String errorDescription) {}

    public SimulationResult simulate(String providerOrderId, Outcome outcome, String method) {
        MockOrder order = orders.get(providerOrderId);
        if (order == null) {
            throw new IllegalArgumentException("Unknown order " + providerOrderId);
        }
        String paymentId = "pay_" + SecureTokens.base62(14);
        ProviderPaymentStatus status = switch (outcome) {
            case SUCCESS -> ProviderPaymentStatus.CAPTURED;   // auto-capture, as configured on Razorpay orders
            case FAILURE -> ProviderPaymentStatus.FAILED;
            case TIMEOUT -> ProviderPaymentStatus.PROCESSING; // bank never confirms
        };
        String error = outcome == Outcome.FAILURE ? "Payment declined by issuing bank" : null;
        payments.put(paymentId, new ProviderPayment(paymentId, providerOrderId, status, order.amountMinor(), method, error));
        order.paymentIds().add(paymentId);

        String signature = outcome == Outcome.SUCCESS
                ? HmacSigner.sign(providerOrderId + "|" + paymentId, order.credentials().keySecret())
                : null;
        return new SimulationResult(outcome, providerOrderId, paymentId, signature, error);
    }

    /** Builds a Razorpay-shaped webhook body and its signature for a simulated payment. */
    public SignedWebhook buildWebhook(String providerPaymentId) {
        ProviderPayment payment = payments.get(providerPaymentId);
        MockOrder order = orders.get(payment.providerOrderId());
        String event = payment.status() == ProviderPaymentStatus.CAPTURED ? "payment.captured" : "payment.failed";
        ObjectNode root = objectMapper.createObjectNode();
        root.put("id", "evt_" + SecureTokens.base62(14));
        root.put("entity", "event");
        root.put("event", event);
        ObjectNode entity = root.putObject("payload").putObject("payment").putObject("entity");
        entity.put("id", payment.providerPaymentId());
        entity.put("order_id", payment.providerOrderId());
        entity.put("amount", payment.amountMinor());
        entity.put("currency", order.currency());
        entity.put("status", payment.status().name().toLowerCase());
        entity.put("method", payment.method());
        String body = root.toString();
        return new SignedWebhook(body, HmacSigner.sign(body, order.credentials().webhookSecret()));
    }

    public record SignedWebhook(String payload, String signature) {}

    private boolean ownedBy(String providerOrderId, MerchantCredentials credentials) {
        MockOrder order = orders.get(providerOrderId);
        return order != null && order.credentials().keyId().equals(credentials.keyId());
    }

    private record MockOrder(String id, long amountMinor, String currency, MerchantCredentials credentials,
                             String receipt, List<String> paymentIds) {}
}
