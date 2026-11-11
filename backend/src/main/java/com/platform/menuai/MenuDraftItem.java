package com.platform.menuai;

import com.platform.common.persistence.BaseEntity;
import com.platform.menu.Dietary;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** An extracted, not-yet-published menu item awaiting owner review. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "menu_draft_item")
public class MenuDraftItem extends BaseEntity {

    @Column(nullable = false, updatable = false)
    private UUID uploadId;

    @Column(nullable = false, updatable = false)
    private UUID restaurantId;

    @Column(nullable = false)
    private String categoryName;

    @Column(nullable = false)
    private String name;

    private String description;

    private BigDecimal price;

    @Enumerated(EnumType.STRING)
    private Dietary dietary;

    @Column(nullable = false)
    private BigDecimal confidence = BigDecimal.ONE;

    /** Field names the extractor was unsure about (e.g. "price", "dietary"); cleared as the owner edits them. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private List<String> uncertainFields = new ArrayList<>();

    @Column(nullable = false)
    private boolean included = true;

    @Column(nullable = false)
    private int sortOrder;
}
