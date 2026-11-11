package com.platform.menu;

import com.platform.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "menu_item")
@SQLRestriction("deleted_at IS NULL")
public class MenuItem extends BaseEntity {

    @Column(nullable = false, updatable = false)
    private UUID restaurantId;

    @Column(nullable = false)
    private UUID categoryId;

    @Column(nullable = false)
    private String name;

    private String description;

    @Column(nullable = false)
    private BigDecimal price;

    private String imageUrl;

    @Column(nullable = false)
    private boolean available = true;

    @Enumerated(EnumType.STRING)
    private Dietary dietary;

    /** Highlighted as "Bestseller" on the customer menu. */
    @Column(nullable = false)
    private boolean featured;

    @Column(nullable = false)
    private int sortOrder;

    private Instant deletedAt;
}
