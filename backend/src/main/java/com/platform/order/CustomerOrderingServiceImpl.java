package com.platform.order;

import com.platform.common.error.ApiException;
import com.platform.common.error.BusinessRuleException;
import com.platform.common.error.NotFoundException;
import com.platform.common.util.Money;
import com.platform.menu.MenuService;
import com.platform.menu.dto.MenuItemResponse;
import com.platform.menu.dto.MenuResponse;
import com.platform.order.dto.CheckoutResponse;
import com.platform.order.dto.CheckoutStatusResponse;
import com.platform.order.dto.CustomerOrderResponse;
import com.platform.order.dto.StartCheckoutRequest;
import com.platform.order.dto.StorefrontResponse;
import com.platform.payment.PaymentService;
import com.platform.payment.dto.ClientPaymentConfirmation;
import com.platform.payment.dto.InitiatePaymentCommand;
import com.platform.payment.dto.PaymentInitiation;
import com.platform.payment.dto.PaymentView;
import com.platform.restaurant.RestaurantService;
import com.platform.restaurant.RestaurantStatus;
import com.platform.restaurant.dto.RestaurantResponse;
import com.platform.table.TableService;
import com.platform.table.dto.TableRef;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class CustomerOrderingServiceImpl implements CustomerOrderingService {

    private final RestaurantService restaurantService;
    private final TableService tableService;
    private final MenuService menuService;
    private final PaymentService paymentService;
    private final CheckoutSessionRepository checkoutRepository;
    private final CustomerOrderRepository orderRepository;

    public CustomerOrderingServiceImpl(RestaurantService restaurantService, TableService tableService,
                                       MenuService menuService, PaymentService paymentService,
                                       CheckoutSessionRepository checkoutRepository,
                                       CustomerOrderRepository orderRepository) {
        this.restaurantService = restaurantService;
        this.tableService = tableService;
        this.menuService = menuService;
        this.paymentService = paymentService;
        this.checkoutRepository = checkoutRepository;
        this.orderRepository = orderRepository;
    }

    @Override
    public StorefrontResponse getStorefront(String restaurantSlug, String tableToken) {
        Resolved resolved = resolve(restaurantSlug, tableToken);
        RestaurantResponse r = resolved.restaurant();
        if (r.status() == RestaurantStatus.SUSPENDED) {
            throw new ApiException(HttpStatus.GONE, "RESTAURANT_UNAVAILABLE", "This restaurant is not available on TableTap right now");
        }
        MenuResponse menu = menuService.getMenu(r.id());
        List<StorefrontResponse.Category> categories = menu.categories().stream()
                .filter(c -> !c.items().isEmpty())
                .map(c -> new StorefrontResponse.Category(c.id(), c.name(), c.description(), c.items().stream()
                        .map(i -> new StorefrontResponse.Item(i.id(), i.name(), i.description(), i.price(), i.imageUrl(),
                                i.available(), i.dietary(), i.featured()))
                        .toList()))
                .toList();
        String disabledReason = orderingDisabledReason(r, resolved.table());
        return new StorefrontResponse(
                new StorefrontResponse.Restaurant(r.slug(), r.name(), r.description(), r.cuisine(), r.logoUrl(),
                        r.coverImageUrl(), r.brandColor(), r.addressLine(), r.city(), r.currency(), r.taxLabel(),
                        r.taxRatePercent()),
                new StorefrontResponse.Table(resolved.table().name(), tableToken),
                disabledReason == null, disabledReason, categories);
    }

    @Override
    @Transactional
    public CheckoutResponse startCheckout(StartCheckoutRequest request) {
        Resolved resolved = resolve(request.restaurantSlug(), request.tableToken());
        RestaurantResponse restaurant = resolved.restaurant();
        String disabledReason = orderingDisabledReason(restaurant, resolved.table());
        if (disabledReason != null) {
            throw new BusinessRuleException("ORDERING_UNAVAILABLE", disabledReason);
        }

        // Merge duplicate lines and price everything from the database.
        Map<UUID, Integer> quantities = new LinkedHashMap<>();
        request.items().forEach(line -> quantities.merge(line.menuItemId(), line.quantity(), Integer::sum));
        Map<UUID, MenuItemResponse> menuItems = menuService.findItems(restaurant.id(), quantities.keySet()).stream()
                .collect(Collectors.toMap(MenuItemResponse::id, Function.identity()));

        List<CheckoutLine> lines = new ArrayList<>();
        BigDecimal subtotal = BigDecimal.ZERO;
        for (Map.Entry<UUID, Integer> entry : quantities.entrySet()) {
            MenuItemResponse item = menuItems.get(entry.getKey());
            if (item == null) {
                throw new BusinessRuleException("ITEM_NOT_FOUND", "An item in your cart is no longer on the menu. Please review your cart.");
            }
            if (!item.available()) {
                throw new BusinessRuleException("ITEM_UNAVAILABLE", item.name() + " is sold out right now. Please remove it to continue.");
            }
            int quantity = entry.getValue();
            if (quantity > 20) {
                throw new BusinessRuleException("QUANTITY_TOO_LARGE", "You can order up to 20 of an item at once");
            }
            BigDecimal lineTotal = Money.of(item.price().multiply(BigDecimal.valueOf(quantity)));
            lines.add(new CheckoutLine(item.id(), item.name(), Money.of(item.price()), quantity, lineTotal,
                    item.dietary() == null ? null : item.dietary().name()));
            subtotal = subtotal.add(lineTotal);
        }
        subtotal = Money.of(subtotal);
        if (subtotal.signum() <= 0) {
            throw new BusinessRuleException("EMPTY_ORDER", "Order total must be greater than zero");
        }
        BigDecimal tax = Money.percentage(subtotal, restaurant.taxRatePercent());
        BigDecimal total = subtotal.add(tax);

        CheckoutSession session = new CheckoutSession();
        session.setRestaurantId(restaurant.id());
        session.setTableId(resolved.table().id());
        session.setCurrency(restaurant.currency());
        session.setItems(lines);
        session.setSubtotal(subtotal);
        session.setTaxAmount(tax);
        session.setTotalAmount(total);
        session.setCustomerNote(request.note() == null || request.note().isBlank() ? null : request.note().trim());
        session = checkoutRepository.save(session);

        PaymentInitiation payment = paymentService.initiate(
                new InitiatePaymentCommand(restaurant.id(), session.getId(), total, restaurant.currency()));

        return new CheckoutResponse(session.getId(), session.getStatus(), restaurant.name(), resolved.table().name(),
                restaurant.currency(), lines, subtotal, restaurant.taxLabel(), restaurant.taxRatePercent(), tax, total, payment);
    }

    @Override
    @Transactional
    public CheckoutStatusResponse confirmPayment(UUID checkoutId, ClientPaymentConfirmation confirmation) {
        CheckoutSession session = loadSession(checkoutId);
        PaymentView payment = latestPayment(session.getId());
        // On success the payment module publishes PaymentCapturedEvent; OrderPlacementService creates the order
        // in this same transaction.
        paymentService.confirm(payment.id(), confirmation);
        return status(session.getId());
    }

    @Override
    @Transactional
    public CheckoutStatusResponse syncPayment(UUID checkoutId) {
        CheckoutSession session = loadSession(checkoutId);
        paymentService.reconcile(latestPayment(session.getId()).id());
        return status(session.getId());
    }

    @Override
    public CheckoutStatusResponse getCheckoutStatus(UUID checkoutId) {
        return status(loadSession(checkoutId).getId());
    }

    @Override
    public CustomerOrderResponse getOrder(UUID orderId) {
        CustomerOrder order = orderRepository.findById(orderId).orElseThrow(() -> new NotFoundException("Order"));
        RestaurantResponse restaurant = restaurantService.get(order.getRestaurantId());
        return new CustomerOrderResponse(order.getId(), order.getOrderNumber(), order.getStatus(), order.getPaymentStatus(),
                restaurant.name(), restaurant.slug(), restaurant.brandColor(), order.getTableName(),
                order.getCurrency().trim(), OrderMapper.items(order), order.getSubtotal(), restaurant.taxLabel(),
                order.getTaxAmount(), order.getTotalAmount(), order.getCreatedAt(), order.getServedAt());
    }

    // ------------------------------------------------------------------

    private CheckoutStatusResponse status(UUID checkoutId) {
        CheckoutSession session = checkoutRepository.findById(checkoutId).orElseThrow(() -> new NotFoundException("Checkout"));
        Optional<PaymentView> payment = paymentService.findLatestForCheckout(checkoutId);
        Optional<CustomerOrder> order = orderRepository.findByCheckoutSessionId(checkoutId);
        return new CheckoutStatusResponse(checkoutId, session.getStatus(),
                payment.map(PaymentView::status).orElse(null),
                payment.map(PaymentView::failureReason).orElse(null),
                order.map(CustomerOrder::getId).orElse(null),
                order.map(CustomerOrder::getOrderNumber).orElse(null));
    }

    private PaymentView latestPayment(UUID checkoutId) {
        return paymentService.findLatestForCheckout(checkoutId).orElseThrow(() -> new NotFoundException("Payment"));
    }

    private CheckoutSession loadSession(UUID checkoutId) {
        return checkoutRepository.findById(checkoutId).orElseThrow(() -> new NotFoundException("Checkout"));
    }

    private Resolved resolve(String slug, String token) {
        TableRef table = tableService.findByQrToken(token)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "TABLE_NOT_FOUND",
                        "This QR code is not valid. Please ask the staff for help."));
        RestaurantResponse restaurant = restaurantService.get(table.restaurantId());
        if (!restaurant.slug().equals(slug)) {
            // Token belongs to a different restaurant than the URL claims — treat as invalid.
            throw new ApiException(HttpStatus.NOT_FOUND, "TABLE_NOT_FOUND", "This QR code is not valid. Please ask the staff for help.");
        }
        return new Resolved(restaurant, table);
    }

    private String orderingDisabledReason(RestaurantResponse restaurant, TableRef table) {
        if (restaurant.status() != RestaurantStatus.ACTIVE) {
            return "This restaurant is not taking orders on TableTap right now.";
        }
        if (!restaurant.acceptingOrders()) {
            return restaurant.name() + " isn't taking online orders at the moment. Please order with the staff.";
        }
        if (!table.active()) {
            return "Ordering is turned off for this table. Please ask the staff for help.";
        }
        if (!paymentService.isAcceptingPayments(restaurant.id())) {
            return "Online payment isn't available right now. Please order with the staff.";
        }
        return null;
    }

    private record Resolved(RestaurantResponse restaurant, TableRef table) {}
}
