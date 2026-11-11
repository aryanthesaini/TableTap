package com.platform.order;

import com.platform.common.web.PageResponse;
import com.platform.order.dto.OrderCountsResponse;
import com.platform.order.dto.OrderFilter;
import com.platform.order.dto.OrderResponse;
import com.platform.order.dto.TableActivityResponse;

import java.util.List;
import java.util.UUID;

/** Restaurant-side order operations. All methods are tenant-scoped. */
public interface OrderService {

    PageResponse<OrderResponse> list(UUID restaurantId, OrderFilter filter, int page, int size);

    OrderResponse get(UUID restaurantId, UUID orderId);

    OrderResponse markServed(UUID restaurantId, UUID orderId, UUID servedBy);

    OrderCountsResponse counts(UUID restaurantId);

    List<TableActivityResponse> tableActivity(UUID restaurantId);
}
