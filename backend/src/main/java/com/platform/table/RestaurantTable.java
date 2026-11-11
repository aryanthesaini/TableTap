package com.platform.table;

import com.platform.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "restaurant_table")
@SQLRestriction("deleted_at IS NULL")
public class RestaurantTable extends BaseEntity {

    @Column(nullable = false, updatable = false)
    private UUID restaurantId;

    @Column(nullable = false)
    private String name;

    private Integer seats;

    /** Opaque, unguessable token encoded in the table's QR URL. Regenerating it invalidates printed codes. */
    @Column(nullable = false, unique = true)
    private String qrToken;

    @Column(nullable = false)
    private Instant qrGeneratedAt;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private int sortOrder;

    private Instant deletedAt;
}
