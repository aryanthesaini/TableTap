package com.platform.order;

import com.platform.common.config.OpenApiConfig;
import com.platform.common.security.CurrentUser;
import com.platform.common.security.CurrentUserProvider;
import com.platform.common.web.PageResponse;
import com.platform.order.dto.OrderCountsResponse;
import com.platform.order.dto.OrderFilter;
import com.platform.order.dto.OrderResponse;
import com.platform.order.dto.TableActivityResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Tag(name = "Orders")
@SecurityRequirement(name = OpenApiConfig.BEARER)
@RestController
@RequestMapping("/api/v1/restaurant/orders")
public class OrderController {

    private final OrderService orderService;
    private final CurrentUserProvider currentUser;

    public OrderController(OrderService orderService, CurrentUserProvider currentUser) {
        this.orderService = orderService;
        this.currentUser = currentUser;
    }

    @Operation(summary = "Search orders", description = "PENDING orders are returned oldest-first; others newest-first. "
            + "`q` matches order number, table name or item name.")
    @GetMapping
    public PageResponse<OrderResponse> list(@RequestParam(required = false) OrderStatus status,
                                            @RequestParam(required = false) UUID tableId,
                                            @RequestParam(required = false) String q,
                                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
                                            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
                                            @RequestParam(defaultValue = "0") int page,
                                            @RequestParam(defaultValue = "25") int size) {
        return orderService.list(currentUser.restaurantId(), new OrderFilter(status, tableId, q, from, to), page, size);
    }

    @Operation(summary = "Pending / served-today counts for tabs and badges")
    @GetMapping("/counts")
    public OrderCountsResponse counts() {
        return orderService.counts(currentUser.restaurantId());
    }

    @Operation(summary = "Per-table activity (pending orders, today's orders and revenue)")
    @GetMapping("/table-activity")
    public List<TableActivityResponse> tableActivity() {
        return orderService.tableActivity(currentUser.restaurantId());
    }

    @Operation(summary = "Order details")
    @GetMapping("/{orderId}")
    public OrderResponse get(@PathVariable UUID orderId) {
        return orderService.get(currentUser.restaurantId(), orderId);
    }

    @Operation(summary = "Mark an order as served (idempotent)")
    @PostMapping("/{orderId}/serve")
    public OrderResponse markServed(@PathVariable UUID orderId) {
        CurrentUser user = currentUser.get();
        return orderService.markServed(user.requireRestaurantId(), orderId, user.userId());
    }
}
