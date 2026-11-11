package com.platform.restaurant;

import com.platform.restaurant.dto.RestaurantResponse;
import com.platform.restaurant.dto.UpdateRestaurantRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RestaurantService {

    RestaurantResponse get(UUID restaurantId);

    Optional<RestaurantResponse> findBySlug(String slug);

    RestaurantResponse update(UUID restaurantId, UpdateRestaurantRequest request);

    RestaurantResponse setAcceptingOrders(UUID restaurantId, boolean acceptingOrders);

    /** Platform admin: activate / suspend a tenant. */
    RestaurantResponse setStatus(UUID restaurantId, RestaurantStatus status);

    List<RestaurantResponse> listAll();

    /** Allocates the next human-friendly order number for the restaurant. Must run inside a transaction. */
    int nextOrderNumber(UUID restaurantId);
}
