package com.platform.payment.mock;

import com.platform.common.config.AppProperties;
import com.platform.common.error.ApiException;
import com.platform.common.error.ConflictException;
import com.platform.common.error.NotFoundException;
import com.platform.payment.Payment;
import com.platform.payment.PaymentRepository;
import com.platform.payment.PaymentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * Simulates the provider's hosted checkout (the part of Razorpay the customer interacts with).
 * It exists only when the mock provider is active. The response is exactly what a real checkout
 * hands to the browser — the backend still verifies it independently in the confirm step.
 */
@Slf4j
@Tag(name = "Mock payment gateway")
@RestController
@RequestMapping("/api/v1/public/mock-gateway")
@ConditionalOnBean(MockPaymentProvider.class)
public class MockGatewayController {

    private final MockPaymentProvider provider;
    private final PaymentRepository paymentRepository;
    private final PaymentService paymentService;
    private final TaskScheduler scheduler;
    private final AppProperties properties;

    public MockGatewayController(MockPaymentProvider provider, PaymentRepository paymentRepository,
                                 PaymentService paymentService, TaskScheduler scheduler, AppProperties properties) {
        this.provider = provider;
        this.paymentRepository = paymentRepository;
        this.paymentService = paymentService;
        this.scheduler = scheduler;
        this.properties = properties;
    }

    public record SimulateRequest(
            @NotNull MockPaymentProvider.Outcome outcome,
            @Pattern(regexp = "UPI|CARD|NETBANKING|WALLET") String method
    ) {}

    public record SimulateResponse(String outcome, String providerOrderId, String providerPaymentId,
                                   String signature, String errorDescription) {}

    @Operation(summary = "Simulate the customer completing (or failing) payment in the provider checkout")
    @PostMapping("/orders/{providerOrderId}/pay")
    public SimulateResponse pay(@PathVariable String providerOrderId, @Valid @RequestBody SimulateRequest request) {
        Payment payment = paymentRepository.findByProviderAndProviderOrderId(MockPaymentProvider.CODE, providerOrderId)
                .orElseThrow(() -> new NotFoundException("Payment order"));
        if (payment.getStatus().isFinal()) {
            throw new ConflictException("PAYMENT_ALREADY_FINAL", "This payment has already been completed");
        }
        MockPaymentProvider.SimulationResult result;
        try {
            result = provider.simulate(providerOrderId, request.outcome(), request.method() == null ? "UPI" : request.method());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.GONE, "PAYMENT_SESSION_EXPIRED",
                    "This payment session is no longer valid. Please start checkout again.");
        }

        if (request.outcome() != MockPaymentProvider.Outcome.TIMEOUT) {
            // The gateway also notifies the merchant server asynchronously, like a real webhook.
            MockPaymentProvider.SignedWebhook webhook = provider.buildWebhook(result.providerPaymentId());
            scheduler.schedule(() -> deliverWebhook(payment, webhook),
                    Instant.now().plus(properties.payments().mockWebhookDelay()));
        }
        return new SimulateResponse(result.outcome().name(), result.providerOrderId(), result.providerPaymentId(),
                result.signature(), result.errorDescription());
    }

    private void deliverWebhook(Payment payment, MockPaymentProvider.SignedWebhook webhook) {
        try {
            paymentService.handleWebhook(MockPaymentProvider.CODE, payment.getRestaurantId(), webhook.payload(), webhook.signature());
        } catch (Exception e) {
            log.warn("Mock webhook delivery failed for payment {}: {}", payment.getId(), e.getMessage());
        }
    }
}
