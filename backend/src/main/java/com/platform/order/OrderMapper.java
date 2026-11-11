package com.platform.order;

import com.platform.order.dto.OrderItemResponse;
import com.platform.order.dto.OrderResponse;

import java.util.List;

final class OrderMapper {

    private OrderMapper() {}

    static List<OrderItemResponse> items(CustomerOrder order) {
        return order.getItems().stream()
                .map(i -> new OrderItemResponse(i.getMenuItemId(), i.getItemName(), i.getUnitPrice(), i.getQuantity(),
                        i.getLineTotal(), i.getDietary()))
                .toList();
    }

    static OrderResponse toResponse(CustomerOrder o) {
        List<OrderItemResponse> items = items(o);
        int count = items.stream().mapToInt(OrderItemResponse::quantity).sum();
        return new OrderResponse(o.getId(), o.getOrderNumber(), o.getTableId(), o.getTableName(), o.getStatus(),
                o.getPaymentStatus(), o.getCurrency().trim(), o.getSubtotal(), o.getTaxAmount(), o.getTotalAmount(),
                o.getCustomerNote(), count, items, o.getCreatedAt(), o.getServedAt());
    }
}
