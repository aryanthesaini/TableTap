package com.platform.payment;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PaymentConfigurationRepository extends JpaRepository<PaymentConfiguration, UUID> {

    Optional<PaymentConfiguration> findByRestaurantId(UUID restaurantId);
}
