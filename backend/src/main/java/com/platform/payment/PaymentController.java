package com.platform.payment;

import com.platform.common.config.OpenApiConfig;
import com.platform.common.security.CurrentUserProvider;
import com.platform.common.web.PageResponse;
import com.platform.payment.dto.PaymentConfigurationResponse;
import com.platform.payment.dto.PaymentSummary;
import com.platform.payment.dto.PaymentView;
import com.platform.payment.dto.UpdatePaymentConfigurationRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Tag(name = "Payments")
@SecurityRequirement(name = OpenApiConfig.BEARER)
@RestController
@RequestMapping("/api/v1/restaurant/payments")
@PreAuthorize("hasRole('OWNER')")
public class PaymentController {

    private final PaymentService paymentService;
    private final CurrentUserProvider currentUser;

    public PaymentController(PaymentService paymentService, CurrentUserProvider currentUser) {
        this.paymentService = paymentService;
        this.currentUser = currentUser;
    }

    @Operation(summary = "Payment transactions (newest first)")
    @GetMapping
    public PageResponse<PaymentView> list(@RequestParam(required = false) PaymentStatus status,
                                          @RequestParam(defaultValue = "0") int page,
                                          @RequestParam(defaultValue = "25") int size) {
        return paymentService.list(currentUser.restaurantId(), status, page, size);
    }

    @Operation(summary = "Payment totals over the last N days")
    @GetMapping("/summary")
    public PaymentSummary summary(@RequestParam(defaultValue = "7") int days) {
        return paymentService.summary(currentUser.restaurantId(), Math.min(Math.max(days, 1), 90));
    }

    @Operation(summary = "Merchant account (Razorpay) connection — secrets are never returned")
    @GetMapping("/configuration")
    public PaymentConfigurationResponse configuration() {
        return paymentService.getConfiguration(currentUser.restaurantId());
    }

    @Operation(summary = "Connect / update the restaurant's own merchant account")
    @PutMapping("/configuration")
    public PaymentConfigurationResponse updateConfiguration(@Valid @RequestBody UpdatePaymentConfigurationRequest request) {
        return paymentService.updateConfiguration(currentUser.restaurantId(), request);
    }
}
