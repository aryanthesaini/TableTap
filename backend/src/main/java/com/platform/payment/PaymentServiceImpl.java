package com.platform.payment;

import com.platform.common.config.AppProperties;
import com.platform.common.error.ApiException;
import com.platform.common.error.BusinessRuleException;
import com.platform.common.error.NotFoundException;
import com.platform.common.web.PageResponse;
import com.platform.payment.dto.ClientPaymentConfirmation;
import com.platform.payment.dto.InitiatePaymentCommand;
import com.platform.payment.dto.PaymentConfigurationResponse;
import com.platform.payment.dto.PaymentInitiation;
import com.platform.payment.dto.PaymentSummary;
import com.platform.payment.dto.PaymentView;
import com.platform.payment.dto.UpdatePaymentConfigurationRequest;
import com.platform.payment.provider.MerchantCredentials;
import com.platform.payment.provider.PaymentProvider;
import com.platform.payment.provider.ProviderOrder;
import com.platform.payment.provider.ProviderPayment;
import com.platform.payment.provider.ProviderWebhookEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@Transactional(readOnly = true)
public class PaymentServiceImpl implements PaymentService {

    private final PaymentRepository paymentRepository;
    private final PaymentConfigurationRepository configurationRepository;
    private final PaymentWebhookEventRepository webhookEventRepository;
    private final PaymentProvider provider;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate transactionTemplate;
    private final AppProperties properties;
    private final Clock clock;

    public PaymentServiceImpl(PaymentRepository paymentRepository,
                              PaymentConfigurationRepository configurationRepository,
                              PaymentWebhookEventRepository webhookEventRepository,
                              PaymentProvider provider,
                              ApplicationEventPublisher events,
                              TransactionTemplate transactionTemplate,
                              AppProperties properties,
                              Clock clock) {
        this.paymentRepository = paymentRepository;
        this.configurationRepository = configurationRepository;
        this.webhookEventRepository = webhookEventRepository;
        this.provider = provider;
        this.events = events;
        this.transactionTemplate = transactionTemplate;
        this.properties = properties;
        this.clock = clock;
    }

    @Override
    public boolean isAcceptingPayments(UUID restaurantId) {
        return configurationRepository.findByRestaurantId(restaurantId).map(PaymentConfiguration::isUsable).orElse(false);
    }

    @Override
    @Transactional
    public PaymentInitiation initiate(InitiatePaymentCommand command) {
        PaymentConfiguration config = usableConfiguration(command.restaurantId());
        ProviderOrder providerOrder;
        try {
            providerOrder = provider.createOrder(credentials(config), command.amount(), command.currency(),
                    command.checkoutSessionId().toString());
        } catch (RuntimeException e) {
            log.error("Provider createOrder failed for restaurant {}", command.restaurantId(), e);
            throw providerUnavailable();
        }
        Payment payment = new Payment();
        payment.setRestaurantId(command.restaurantId());
        payment.setCheckoutSessionId(command.checkoutSessionId());
        payment.setProvider(provider.code());
        payment.setProviderOrderId(providerOrder.providerOrderId());
        payment.setAmount(command.amount());
        payment.setCurrency(command.currency());
        payment.setStatus(PaymentStatus.CREATED);
        payment = paymentRepository.save(payment);
        return new PaymentInitiation(payment.getId(), provider.code(), config.getKeyId(), providerOrder.providerOrderId(),
                command.amount(), providerOrder.amountMinor(), command.currency());
    }

    @Override
    @Transactional
    public UUID initiateCash(UUID restaurantId, UUID checkoutSessionId, BigDecimal amount, String currency) {
        Payment payment = new Payment();
        payment.setRestaurantId(restaurantId);
        payment.setCheckoutSessionId(checkoutSessionId);
        payment.setProvider("CASH");
        payment.setProviderOrderId("cash-" + checkoutSessionId);
        payment.setAmount(amount);
        payment.setCurrency(currency);
        payment.setStatus(PaymentStatus.CASH);
        payment.setCapturedAt(clock.instant());
        return paymentRepository.save(payment).getId();
    }

    @Override
    @Transactional
    public PaymentView confirm(UUID paymentId, ClientPaymentConfirmation confirmation) {
        Payment payment = lock(paymentId);
        MerchantCredentials credentials = credentials(configurationFor(payment.getRestaurantId()));

        // 1. The browser's claim must be cryptographically bound to *this* payment's provider order.
        boolean signatureValid = payment.getProviderOrderId().equals(confirmation.providerOrderId())
                && provider.verifyPaymentSignature(credentials, confirmation.providerOrderId(),
                confirmation.providerPaymentId(), confirmation.signature());
        if (!signatureValid) {
            log.warn("Rejected payment confirmation with invalid signature for payment {}", paymentId);
            throw new ApiException(HttpStatus.BAD_REQUEST, "PAYMENT_VERIFICATION_FAILED",
                    "We could not verify this payment. You have not been charged twice — please try again.");
        }
        if (payment.getStatus().isFinal()) {
            return toView(payment);
        }
        // 2. Ask the provider for the authoritative status rather than trusting the browser.
        ProviderPayment providerPayment;
        try {
            providerPayment = provider.fetchPayment(credentials, confirmation.providerPaymentId());
        } catch (RuntimeException e) {
            log.error("Provider fetchPayment failed for payment {}", paymentId, e);
            throw providerUnavailable();
        }
        applyProviderState(payment, providerPayment);
        return toView(payment);
    }

    @Override
    @Transactional
    public PaymentView reconcile(UUID paymentId) {
        Payment payment = lock(paymentId);
        if (payment.getStatus().isFinal()) {
            return toView(payment);
        }
        MerchantCredentials credentials = credentials(configurationFor(payment.getRestaurantId()));
        try {
            provider.fetchLatestPaymentForOrder(credentials, payment.getProviderOrderId())
                    .ifPresent(pp -> applyProviderState(payment, pp));
        } catch (RuntimeException e) {
            log.warn("Reconciliation failed for payment {}: {}", paymentId, e.getMessage());
        }
        return toView(payment);
    }

    @Override
    public Optional<PaymentView> findLatestForCheckout(UUID checkoutSessionId) {
        return paymentRepository.findFirstByCheckoutSessionIdOrderByCreatedAtDesc(checkoutSessionId).map(PaymentServiceImpl::toView);
    }

    @Override
    @Transactional
    public void handleWebhook(String providerCode, UUID restaurantId, String payload, String signature) {
        if (!provider.code().equalsIgnoreCase(providerCode)) {
            throw new NotFoundException("Payment provider");
        }
        PaymentConfiguration config = configurationFor(restaurantId);
        if (!provider.verifyWebhookSignature(credentials(config), payload, signature)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_SIGNATURE", "Webhook signature verification failed");
        }
        ProviderWebhookEvent event;
        try {
            event = provider.parseWebhook(payload);
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MALFORMED_WEBHOOK", e.getMessage());
        }
        if (webhookEventRepository.existsByProviderAndEventId(provider.code(), event.eventId())) {
            log.info("Duplicate webhook {} ignored", event.eventId());
            return;
        }
        PaymentWebhookEvent record = new PaymentWebhookEvent();
        record.setProvider(provider.code());
        record.setEventId(event.eventId());
        record.setEventType(event.eventType());
        record.setPayload(payload);
        record.setReceivedAt(clock.instant());
        webhookEventRepository.save(record);

        Optional<Payment> payment = paymentRepository.findByProviderAndProviderOrderId(provider.code(), event.providerOrderId())
                .filter(p -> p.getRestaurantId().equals(restaurantId));
        if (payment.isEmpty()) {
            log.warn("Webhook {} references unknown order {}", event.eventId(), event.providerOrderId());
            return;
        }
        // The webhook is only a trigger: state is always re-read from the provider.
        reconcile(payment.get().getId());
        log.info("Processed webhook {} ({}) for payment {}", event.eventId(), event.eventType(), payment.get().getId());
    }

    @Override
    @Transactional
    public void linkOrder(UUID paymentId, UUID orderId, int orderNumber) {
        Payment payment = paymentRepository.findById(paymentId).orElseThrow(() -> new NotFoundException("Payment"));
        payment.setOrderId(orderId);
        payment.setOrderNumber(orderNumber);
    }

    @Override
    @Transactional(propagation = Propagation.NOT_SUPPORTED) // each payment gets its own write transaction
    public int expireStalePayments() {
        Instant cutoff = clock.instant().minus(properties.payments().pendingTimeout());
        List<UUID> stale = paymentRepository.findStaleIds(List.of(PaymentStatus.CREATED, PaymentStatus.PENDING), cutoff);
        int expired = 0;
        for (UUID id : stale) {
            Boolean result = transactionTemplate.execute(tx -> {
                PaymentView view = reconcile(id);
                if (view.status().isFinal()) {
                    return false;
                }
                Payment payment = lock(id);
                markFailed(payment, "Payment timed out");
                return true;
            });
            if (Boolean.TRUE.equals(result)) {
                expired++;
            }
        }
        return expired;
    }

    @Override
    public PageResponse<PaymentView> list(UUID restaurantId, PaymentStatus status, int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createdAt"));
        var result = status == null
                ? paymentRepository.findAllByRestaurantId(restaurantId, pageable)
                : paymentRepository.findAllByRestaurantIdAndStatus(restaurantId, status, pageable);
        return PageResponse.of(result, PaymentServiceImpl::toView);
    }

    @Override
    public PaymentSummary summary(UUID restaurantId, int days) {
        Instant from = clock.instant().minus(Duration.ofDays(days));
        long captured = paymentRepository.countSince(restaurantId, PaymentStatus.CAPTURED, from);
        long failed = paymentRepository.countSince(restaurantId, PaymentStatus.FAILED, from);
        long pending = paymentRepository.countSince(restaurantId, PaymentStatus.PENDING, from)
                + paymentRepository.countSince(restaurantId, PaymentStatus.CREATED, from);
        BigDecimal amount = paymentRepository.sumSince(restaurantId, PaymentStatus.CAPTURED, from);
        double rate = captured + failed == 0 ? 0 : BigDecimal.valueOf(captured * 100.0 / (captured + failed))
                .setScale(1, RoundingMode.HALF_UP).doubleValue();
        return new PaymentSummary(days, captured, amount, failed, pending, rate);
    }

    @Override
    public PaymentConfigurationResponse getConfiguration(UUID restaurantId) {
        return configurationRepository.findByRestaurantId(restaurantId)
                .map(c -> toResponse(c, restaurantId))
                .orElseGet(() -> new PaymentConfigurationResponse("RAZORPAY", "TEST", "NOT_CONNECTED", null, false,
                        false, webhookUrl(restaurantId), null));
    }

    @Override
    @Transactional
    public PaymentConfigurationResponse updateConfiguration(UUID restaurantId, UpdatePaymentConfigurationRequest request) {
        PaymentConfiguration config = configurationRepository.findByRestaurantId(restaurantId).orElseGet(() -> {
            PaymentConfiguration created = new PaymentConfiguration();
            created.setRestaurantId(restaurantId);
            return created;
        });
        String keySecret = isBlank(request.keySecret()) ? config.getKeySecret() : request.keySecret().trim();
        String webhookSecret = isBlank(request.webhookSecret()) ? config.getWebhookSecret() : request.webhookSecret().trim();
        MerchantCredentials candidate = new MerchantCredentials(request.keyId().trim(), keySecret, webhookSecret,
                request.mode() == PaymentConfiguration.Mode.LIVE);
        try {
            provider.validateCredentials(candidate);
        } catch (IllegalArgumentException e) {
            throw new BusinessRuleException("INVALID_CREDENTIALS", e.getMessage());
        }
        if (isBlank(webhookSecret)) {
            throw new BusinessRuleException("INVALID_CREDENTIALS", "A webhook secret is required");
        }
        config.setMode(request.mode());
        config.setKeyId(candidate.keyId());
        config.setKeySecret(keySecret);
        config.setWebhookSecret(webhookSecret);
        config.setStatus(PaymentConfiguration.Status.ACTIVE);
        config.setConnectedAt(clock.instant());
        return toResponse(configurationRepository.saveAndFlush(config), restaurantId);
    }

    // ------------------------------------------------------------------

    private void applyProviderState(Payment payment, ProviderPayment pp) {
        switch (pp.status()) {
            case CAPTURED, AUTHORIZED -> {
                long expectedMinor = payment.getAmount().movePointRight(2).longValueExact();
                if (pp.amountMinor() != expectedMinor) {
                    log.error("Amount mismatch for payment {}: expected {} got {}", payment.getId(), expectedMinor, pp.amountMinor());
                    markFailed(payment, "Amount mismatch reported by provider");
                    return;
                }
                payment.setProviderPaymentId(pp.providerPaymentId());
                payment.setMethod(pp.method());
                payment.setStatus(PaymentStatus.CAPTURED);
                payment.setCapturedAt(clock.instant());
                payment.setFailureReason(null);
                paymentRepository.saveAndFlush(payment);
                events.publishEvent(new PaymentCapturedEvent(payment.getId(), payment.getRestaurantId(),
                        payment.getCheckoutSessionId(), payment.getAmount(), payment.getMethod()));
            }
            case FAILED -> {
                payment.setProviderPaymentId(pp.providerPaymentId());
                payment.setMethod(pp.method());
                markFailed(payment, pp.errorDescription() == null ? "Payment failed" : pp.errorDescription());
            }
            case PROCESSING -> {
                payment.setProviderPaymentId(pp.providerPaymentId());
                payment.setMethod(pp.method());
                payment.setStatus(PaymentStatus.PENDING);
            }
            case REFUNDED -> payment.setStatus(PaymentStatus.REFUNDED);
            case NONE -> { /* no attempt yet */ }
        }
    }

    private void markFailed(Payment payment, String reason) {
        payment.setStatus(PaymentStatus.FAILED);
        payment.setFailureReason(reason);
        paymentRepository.saveAndFlush(payment);
        events.publishEvent(new PaymentFailedEvent(payment.getId(), payment.getRestaurantId(),
                payment.getCheckoutSessionId(), reason));
    }

    private Payment lock(UUID paymentId) {
        return paymentRepository.findByIdForUpdate(paymentId).orElseThrow(() -> new NotFoundException("Payment"));
    }

    private PaymentConfiguration configurationFor(UUID restaurantId) {
        return configurationRepository.findByRestaurantId(restaurantId)
                .orElseThrow(() -> new BusinessRuleException("PAYMENTS_NOT_CONFIGURED",
                        "This restaurant has not set up online payments yet"));
    }

    private PaymentConfiguration usableConfiguration(UUID restaurantId) {
        PaymentConfiguration config = configurationFor(restaurantId);
        if (!config.isUsable()) {
            throw new BusinessRuleException("PAYMENTS_NOT_CONFIGURED", "This restaurant is not accepting online payments right now");
        }
        return config;
    }

    private static MerchantCredentials credentials(PaymentConfiguration c) {
        return new MerchantCredentials(c.getKeyId(), c.getKeySecret(), c.getWebhookSecret(),
                c.getMode() == PaymentConfiguration.Mode.LIVE);
    }

    private static ApiException providerUnavailable() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "PAYMENT_PROVIDER_ERROR",
                "The payment provider is not responding. Please try again in a moment.");
    }

    private String webhookUrl(UUID restaurantId) {
        return "/api/v1/webhooks/payments/" + provider.code().toLowerCase() + "/" + restaurantId;
    }

    private PaymentConfigurationResponse toResponse(PaymentConfiguration c, UUID restaurantId) {
        return new PaymentConfigurationResponse(c.getProvider(), c.getMode().name(), c.getStatus().name(), c.getKeyId(),
                c.getKeySecret() != null, c.getWebhookSecret() != null, webhookUrl(restaurantId), c.getConnectedAt());
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    static PaymentView toView(Payment p) {
        return new PaymentView(p.getId(), p.getCheckoutSessionId(), p.getOrderId(), p.getOrderNumber(), p.getProvider(),
                p.getProviderOrderId(), p.getProviderPaymentId(), p.getAmount(), p.getCurrency().trim(), p.getStatus(),
                p.getMethod(), p.getFailureReason(), p.getCreatedAt(), p.getCapturedAt());
    }
}
