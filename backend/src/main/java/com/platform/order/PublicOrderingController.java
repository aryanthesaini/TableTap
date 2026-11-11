package com.platform.order;

import com.platform.order.dto.CheckoutResponse;
import com.platform.order.dto.CheckoutStatusResponse;
import com.platform.order.dto.CustomerOrderResponse;
import com.platform.order.dto.StartCheckoutRequest;
import com.platform.order.dto.StorefrontResponse;
import com.platform.payment.dto.ClientPaymentConfirmation;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Customer-facing endpoints. No login: access is scoped by the table QR token and unguessable ids. */
@Tag(name = "Customer ordering (public)")
@RestController
@RequestMapping("/api/v1/public")
public class PublicOrderingController {

    private final CustomerOrderingService orderingService;

    public PublicOrderingController(CustomerOrderingService orderingService) {
        this.orderingService = orderingService;
    }

    @Operation(summary = "Restaurant branding, table and menu for a scanned QR code")
    @GetMapping("/storefront/{restaurantSlug}/tables/{tableToken}")
    public StorefrontResponse storefront(@PathVariable String restaurantSlug, @PathVariable String tableToken) {
        return orderingService.getStorefront(restaurantSlug, tableToken);
    }

    @Operation(summary = "Start checkout: prices the cart server-side and opens a payment")
    @PostMapping("/checkout")
    @ResponseStatus(HttpStatus.CREATED)
    public CheckoutResponse startCheckout(@Valid @RequestBody StartCheckoutRequest request) {
        return orderingService.startCheckout(request);
    }

    @Operation(summary = "Checkout / payment / order status")
    @GetMapping("/checkout/{checkoutId}")
    public CheckoutStatusResponse checkoutStatus(@PathVariable UUID checkoutId) {
        return orderingService.getCheckoutStatus(checkoutId);
    }

    @Operation(summary = "Submit the provider checkout result for server-side verification")
    @PostMapping("/checkout/{checkoutId}/confirm")
    public CheckoutStatusResponse confirm(@PathVariable UUID checkoutId,
                                          @Valid @RequestBody ClientPaymentConfirmation confirmation) {
        return orderingService.confirmPayment(checkoutId, confirmation);
    }

    @Operation(summary = "Re-check payment status with the provider (after a timeout)")
    @PostMapping("/checkout/{checkoutId}/sync")
    public CheckoutStatusResponse sync(@PathVariable UUID checkoutId) {
        return orderingService.syncPayment(checkoutId);
    }

    @Operation(summary = "Order confirmation / tracking for the customer")
    @GetMapping("/orders/{orderId}")
    public CustomerOrderResponse order(@PathVariable UUID orderId) {
        return orderingService.getOrder(orderId);
    }
}
