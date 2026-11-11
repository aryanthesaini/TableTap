package com.platform.order;

import com.platform.order.dto.CheckoutResponse;
import com.platform.order.dto.CheckoutStatusResponse;
import com.platform.order.dto.CustomerOrderResponse;
import com.platform.order.dto.StartCheckoutRequest;
import com.platform.order.dto.StorefrontResponse;
import com.platform.payment.dto.ClientPaymentConfirmation;

import java.util.UUID;

/** Public, unauthenticated customer journey: menu → checkout → payment → order confirmation. */
public interface CustomerOrderingService {

    StorefrontResponse getStorefront(String restaurantSlug, String tableToken);

    /** Validates and prices the cart server-side, then opens a payment with the restaurant's provider account. */
    CheckoutResponse startCheckout(StartCheckoutRequest request);

    /** Forwards the provider checkout result for server-side verification. */
    CheckoutStatusResponse confirmPayment(UUID checkoutId, ClientPaymentConfirmation confirmation);

    /** Re-checks the payment with the provider (e.g. after a timeout) and returns the current state. */
    CheckoutStatusResponse syncPayment(UUID checkoutId);

    CheckoutStatusResponse getCheckoutStatus(UUID checkoutId);

    CustomerOrderResponse getOrder(UUID orderId);
}
