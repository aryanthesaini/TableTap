package com.platform.payment;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.platform.common.config.AppProperties;
import com.platform.common.error.ApiException;
import com.platform.payment.dto.ClientPaymentConfirmation;
import com.platform.payment.dto.InitiatePaymentCommand;
import com.platform.payment.dto.PaymentInitiation;
import com.platform.payment.dto.PaymentView;
import com.platform.payment.mock.MockPaymentProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.support.TransactionCallback;
import org.springframework.transaction.support.TransactionTemplate;

import java.lang.reflect.Field;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Exercises the payment service against the real mock gateway (signatures, provider lookups),
 * with repositories mocked.
 */
@ExtendWith(MockitoExtension.class)
class PaymentServiceImplTest {

    private static final UUID RESTAURANT = UUID.randomUUID();

    @Mock PaymentRepository paymentRepository;
    @Mock PaymentConfigurationRepository configurationRepository;
    @Mock PaymentWebhookEventRepository webhookEventRepository;
    @Mock ApplicationEventPublisher events;
    @Mock TransactionTemplate transactionTemplate;

    MockPaymentProvider provider = new MockPaymentProvider(new ObjectMapper());
    Clock clock = Clock.fixed(Instant.parse("2026-11-11T08:00:00Z"), ZoneOffset.UTC);
    PaymentServiceImpl service;
    Payment stored;

    @BeforeEach
    void setUp() {
        AppProperties properties = new AppProperties("http://localhost:3000", "Asia/Kolkata",
                new AppProperties.Security("x".repeat(64), Duration.ofHours(1)),
                new AppProperties.Payments("mock", Duration.ofMinutes(15), Duration.ofSeconds(1)),
                new AppProperties.Storage("local", "target/x", "/files"),
                new AppProperties.MenuAi("mock", Duration.ZERO),
                new AppProperties.Demo(true));
        service = new PaymentServiceImpl(paymentRepository, configurationRepository, webhookEventRepository, provider,
                events, transactionTemplate, properties, clock);

        PaymentConfiguration config = new PaymentConfiguration();
        config.setRestaurantId(RESTAURANT);
        config.setStatus(PaymentConfiguration.Status.ACTIVE);
        config.setKeyId("rzp_test_Abc12345");
        config.setKeySecret("secret_for_tests");
        config.setWebhookSecret("whsec_tests");
        lenient().when(configurationRepository.findByRestaurantId(RESTAURANT)).thenReturn(Optional.of(config));
        lenient().when(paymentRepository.save(any())).thenAnswer(inv -> {
            stored = inv.getArgument(0);
            setId(stored, UUID.randomUUID());
            return stored;
        });
        lenient().when(paymentRepository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        lenient().when(paymentRepository.findByIdForUpdate(any())).thenAnswer(inv -> Optional.ofNullable(stored));
    }

    private PaymentInitiation initiate() {
        return service.initiate(new InitiatePaymentCommand(RESTAURANT, UUID.randomUUID(), new BigDecimal("546.00"), "INR"));
    }

    @Test
    void initiateCreatesProviderOrderAndExposesOnlyPublicKey() {
        PaymentInitiation init = initiate();

        assertThat(init.providerOrderId()).startsWith("order_");
        assertThat(init.amountMinor()).isEqualTo(54600);
        assertThat(init.keyId()).isEqualTo("rzp_test_Abc12345");
        assertThat(init.toString()).doesNotContain("secret_for_tests");
        assertThat(stored.getStatus()).isEqualTo(PaymentStatus.CREATED);
    }

    @Test
    void verifiedSuccessfulPaymentIsCapturedAndAnnouncedExactlyOnce() {
        PaymentInitiation init = initiate();
        var result = provider.simulate(init.providerOrderId(), MockPaymentProvider.Outcome.SUCCESS, "UPI");
        var confirmation = new ClientPaymentConfirmation(result.providerOrderId(), result.providerPaymentId(), result.signature());

        PaymentView first = service.confirm(stored.getId(), confirmation);
        PaymentView second = service.confirm(stored.getId(), confirmation);

        assertThat(first.status()).isEqualTo(PaymentStatus.CAPTURED);
        assertThat(second.status()).isEqualTo(PaymentStatus.CAPTURED);
        assertThat(stored.getProviderPaymentId()).isEqualTo(result.providerPaymentId());
        verify(events, times(1)).publishEvent(any(PaymentCapturedEvent.class));
    }

    @Test
    void forgedSignatureIsRejectedAndPaymentUntouched() {
        PaymentInitiation init = initiate();
        var result = provider.simulate(init.providerOrderId(), MockPaymentProvider.Outcome.SUCCESS, "UPI");

        assertThatThrownBy(() -> service.confirm(stored.getId(),
                new ClientPaymentConfirmation(result.providerOrderId(), result.providerPaymentId(), "deadbeef")))
                .isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("PAYMENT_VERIFICATION_FAILED");

        assertThat(stored.getStatus()).isEqualTo(PaymentStatus.CREATED);
        verify(events, never()).publishEvent(any());
    }

    @Test
    void frontendCannotClaimSuccessForAFailedPayment() {
        PaymentInitiation init = initiate();
        var failed = provider.simulate(init.providerOrderId(), MockPaymentProvider.Outcome.FAILURE, "CARD");
        // Attacker crafts a "success" using a signature from nowhere: there is no valid signature for a failed payment.
        assertThatThrownBy(() -> service.confirm(stored.getId(),
                new ClientPaymentConfirmation(failed.providerOrderId(), failed.providerPaymentId(), "0".repeat(64))))
                .isInstanceOf(ApiException.class);

        // The provider is the source of truth: reconciliation records the failure.
        PaymentView view = service.reconcile(stored.getId());
        assertThat(view.status()).isEqualTo(PaymentStatus.FAILED);
        assertThat(view.failureReason()).contains("declined");
        verify(events).publishEvent(any(PaymentFailedEvent.class));
        verify(events, never()).publishEvent(any(PaymentCapturedEvent.class));
    }

    @Test
    void timeoutLeavesPaymentPendingUntilItExpires() {
        PaymentInitiation init = initiate();
        provider.simulate(init.providerOrderId(), MockPaymentProvider.Outcome.TIMEOUT, "UPI");

        assertThat(service.reconcile(stored.getId()).status()).isEqualTo(PaymentStatus.PENDING);

        when(paymentRepository.findStaleIds(any(), any())).thenReturn(List.of(stored.getId()));
        when(transactionTemplate.execute(any())).thenAnswer(inv -> ((TransactionCallback<?>) inv.getArgument(0)).doInTransaction(null));

        assertThat(service.expireStalePayments()).isEqualTo(1);
        assertThat(stored.getStatus()).isEqualTo(PaymentStatus.FAILED);
        assertThat(stored.getFailureReason()).isEqualTo("Payment timed out");
    }

    @Test
    void webhookWithBadSignatureIsRejected() {
        initiate();
        assertThatThrownBy(() -> service.handleWebhook("mock", RESTAURANT, "{\"id\":\"evt_1\"}", "bad"))
                .isInstanceOf(ApiException.class)
                .extracting("code").isEqualTo("INVALID_SIGNATURE");
        verify(webhookEventRepository, never()).save(any());
    }

    @Test
    void signedWebhookCapturesPaymentAndDuplicatesAreIgnored() {
        PaymentInitiation init = initiate();
        var result = provider.simulate(init.providerOrderId(), MockPaymentProvider.Outcome.SUCCESS, "UPI");
        var webhook = provider.buildWebhook(result.providerPaymentId());
        when(paymentRepository.findByProviderAndProviderOrderId("MOCK", init.providerOrderId())).thenReturn(Optional.of(stored));
        when(webhookEventRepository.existsByProviderAndEventId(eq("MOCK"), anyString())).thenReturn(false, true);

        service.handleWebhook("mock", RESTAURANT, webhook.payload(), webhook.signature());
        service.handleWebhook("mock", RESTAURANT, webhook.payload(), webhook.signature());

        assertThat(stored.getStatus()).isEqualTo(PaymentStatus.CAPTURED);
        verify(webhookEventRepository, times(1)).save(any());
        verify(events, times(1)).publishEvent(any(PaymentCapturedEvent.class));
    }

    private static void setId(Object entity, UUID id) {
        try {
            Field f = com.platform.common.persistence.BaseEntity.class.getDeclaredField("id");
            f.setAccessible(true);
            if (f.get(entity) == null) {
                f.set(entity, id);
            }
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
