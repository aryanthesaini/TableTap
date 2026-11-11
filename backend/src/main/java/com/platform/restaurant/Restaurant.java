package com.platform.restaurant;

import com.platform.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "restaurant")
public class Restaurant extends BaseEntity {

    @Column(nullable = false, unique = true, updatable = false)
    private String slug;

    @Column(nullable = false)
    private String name;

    private String description;
    private String cuisine;
    private String logoUrl;
    private String coverImageUrl;

    @Column(nullable = false)
    private String brandColor;

    private String addressLine;
    private String city;
    private String state;
    private String postalCode;
    private String phone;
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RestaurantStatus status = RestaurantStatus.ACTIVE;

    /** Operating status controlled by the restaurant owner ("open for orders"). */
    @Column(nullable = false)
    private boolean acceptingOrders = true;

    @Column(nullable = false)
    private String currency = "INR";

    @Column(nullable = false)
    private String taxLabel = "GST";

    @Column(nullable = false)
    private BigDecimal taxRatePercent = BigDecimal.valueOf(5);

    public boolean canAcceptOrders() {
        return status == RestaurantStatus.ACTIVE && acceptingOrders;
    }
}
