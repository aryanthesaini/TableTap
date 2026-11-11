package com.platform.restaurant;

import com.platform.common.error.NotFoundException;
import com.platform.restaurant.dto.RestaurantResponse;
import com.platform.restaurant.dto.UpdateRestaurantRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class RestaurantServiceImpl implements RestaurantService {

    private final RestaurantRepository repository;

    public RestaurantServiceImpl(RestaurantRepository repository) {
        this.repository = repository;
    }

    @Override
    public RestaurantResponse get(UUID restaurantId) {
        return toResponse(load(restaurantId));
    }

    @Override
    public Optional<RestaurantResponse> findBySlug(String slug) {
        return repository.findBySlug(slug).map(RestaurantServiceImpl::toResponse);
    }

    @Override
    @Transactional
    public RestaurantResponse update(UUID restaurantId, UpdateRestaurantRequest r) {
        Restaurant restaurant = load(restaurantId);
        restaurant.setName(r.name().trim());
        restaurant.setDescription(blankToNull(r.description()));
        restaurant.setCuisine(blankToNull(r.cuisine()));
        restaurant.setLogoUrl(blankToNull(r.logoUrl()));
        restaurant.setBrandColor(r.brandColor().toUpperCase());
        restaurant.setAddressLine(blankToNull(r.addressLine()));
        restaurant.setCity(blankToNull(r.city()));
        restaurant.setState(blankToNull(r.state()));
        restaurant.setPostalCode(blankToNull(r.postalCode()));
        restaurant.setPhone(blankToNull(r.phone()));
        restaurant.setEmail(blankToNull(r.email()));
        restaurant.setTaxLabel(r.taxLabel().trim());
        restaurant.setTaxRatePercent(r.taxRatePercent());
        return toResponse(repository.saveAndFlush(restaurant));
    }

    @Override
    @Transactional
    public RestaurantResponse setAcceptingOrders(UUID restaurantId, boolean acceptingOrders) {
        Restaurant restaurant = load(restaurantId);
        restaurant.setAcceptingOrders(acceptingOrders);
        return toResponse(repository.saveAndFlush(restaurant));
    }

    @Override
    @Transactional
    public RestaurantResponse setStatus(UUID restaurantId, RestaurantStatus status) {
        Restaurant restaurant = load(restaurantId);
        restaurant.setStatus(status);
        return toResponse(repository.saveAndFlush(restaurant));
    }

    @Override
    public List<RestaurantResponse> listAll() {
        return repository.findAllByOrderByNameAsc().stream().map(RestaurantServiceImpl::toResponse).toList();
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public int nextOrderNumber(UUID restaurantId) {
        return repository.incrementAndGetOrderSequence(restaurantId);
    }

    private Restaurant load(UUID id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException("Restaurant"));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    static RestaurantResponse toResponse(Restaurant r) {
        return new RestaurantResponse(r.getId(), r.getSlug(), r.getName(), r.getDescription(), r.getCuisine(),
                r.getLogoUrl(), r.getCoverImageUrl(), r.getBrandColor(), r.getAddressLine(), r.getCity(), r.getState(),
                r.getPostalCode(), r.getPhone(), r.getEmail(), r.getStatus(), r.isAcceptingOrders(), r.getCurrency().trim(),
                r.getTaxLabel(), r.getTaxRatePercent(), r.getCreatedAt());
    }
}
