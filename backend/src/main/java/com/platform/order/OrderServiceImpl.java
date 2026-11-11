package com.platform.order;

import com.platform.common.error.NotFoundException;
import com.platform.common.web.PageResponse;
import com.platform.order.dto.OrderCountsResponse;
import com.platform.order.dto.OrderFilter;
import com.platform.order.dto.OrderResponse;
import com.platform.order.dto.TableActivityResponse;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class OrderServiceImpl implements OrderService {

    private final CustomerOrderRepository orderRepository;
    private final Clock clock;
    private final ZoneId businessZone;

    public OrderServiceImpl(CustomerOrderRepository orderRepository, Clock clock, ZoneId businessZone) {
        this.orderRepository = orderRepository;
        this.clock = clock;
        this.businessZone = businessZone;
    }

    @Override
    public PageResponse<OrderResponse> list(UUID restaurantId, OrderFilter filter, int page, int size) {
        Sort sort = filter.status() == OrderStatus.PENDING
                ? Sort.by(Sort.Direction.ASC, "createdAt")   // oldest first: serve in order
                : Sort.by(Sort.Direction.DESC, "createdAt");
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), sort);
        return PageResponse.of(orderRepository.findAll(spec(restaurantId, filter), pageable), OrderMapper::toResponse);
    }

    @Override
    public OrderResponse get(UUID restaurantId, UUID orderId) {
        return OrderMapper.toResponse(load(restaurantId, orderId));
    }

    @Override
    @Transactional
    public OrderResponse markServed(UUID restaurantId, UUID orderId, UUID servedBy) {
        CustomerOrder order = load(restaurantId, orderId);
        if (order.getStatus() != OrderStatus.SERVED) { // idempotent: a double tap is harmless
            order.setStatus(OrderStatus.SERVED);
            order.setServedAt(clock.instant());
            order.setServedBy(servedBy);
        }
        return OrderMapper.toResponse(orderRepository.saveAndFlush(order));
    }

    @Override
    public OrderCountsResponse counts(UUID restaurantId) {
        Instant startOfDay = startOfToday();
        return new OrderCountsResponse(
                orderRepository.countByRestaurantIdAndStatus(restaurantId, OrderStatus.PENDING),
                orderRepository.countByRestaurantIdAndStatusAndCreatedAtGreaterThanEqual(restaurantId, OrderStatus.SERVED, startOfDay),
                orderRepository.countByRestaurantIdAndCreatedAtGreaterThanEqual(restaurantId, startOfDay));
    }

    @Override
    public List<TableActivityResponse> tableActivity(UUID restaurantId) {
        return orderRepository.tableActivity(restaurantId, startOfToday()).stream()
                .map(row -> new TableActivityResponse((UUID) row[0], ((Number) row[1]).longValue(),
                        ((Number) row[2]).longValue(), (BigDecimal) row[3], (Instant) row[4]))
                .toList();
    }

    private Instant startOfToday() {
        return LocalDate.now(clock.withZone(businessZone)).atStartOfDay(businessZone).toInstant();
    }

    private CustomerOrder load(UUID restaurantId, UUID orderId) {
        return orderRepository.findByIdAndRestaurantId(orderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Order"));
    }

    private static Specification<CustomerOrder> spec(UUID restaurantId, OrderFilter f) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("restaurantId"), restaurantId));
            if (f.status() != null) {
                predicates.add(cb.equal(root.get("status"), f.status()));
            }
            if (f.tableId() != null) {
                predicates.add(cb.equal(root.get("tableId"), f.tableId()));
            }
            if (f.from() != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), f.from()));
            }
            if (f.to() != null) {
                predicates.add(cb.lessThan(root.get("createdAt"), f.to()));
            }
            if (f.query() != null && !f.query().isBlank()) {
                String q = f.query().trim().replace("#", "");
                Subquery<UUID> itemMatch = query.subquery(UUID.class);
                var item = itemMatch.from(OrderItem.class);
                Join<OrderItem, CustomerOrder> parent = item.join("order");
                itemMatch.select(parent.get("id")).where(
                        cb.equal(parent.get("id"), root.get("id")),
                        cb.like(cb.lower(item.get("itemName")), "%" + q.toLowerCase() + "%"));
                Predicate byItem = cb.exists(itemMatch);
                Predicate byTable = cb.like(cb.lower(root.get("tableName")), "%" + q.toLowerCase() + "%");
                if (q.matches("\\d{1,9}")) {
                    predicates.add(cb.or(cb.equal(root.get("orderNumber"), Integer.parseInt(q)), byItem, byTable));
                } else {
                    predicates.add(cb.or(byItem, byTable));
                }
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }
}
