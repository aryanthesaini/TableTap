package com.platform.payment;

import com.platform.common.persistence.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * The restaurant's own merchant account credentials. Payments are made directly to the
 * restaurant's account; the platform never holds funds.
 * <p>Production note: {@code keySecret} and {@code webhookSecret} must be encrypted at rest.
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "payment_configuration")
public class PaymentConfiguration extends BaseEntity {

    public enum Mode { TEST, LIVE }

    public enum Status { NOT_CONNECTED, ACTIVE, DISABLED }

    @Column(nullable = false, unique = true, updatable = false)
    private UUID restaurantId;

    @Column(nullable = false)
    private String provider = "RAZORPAY";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Mode mode = Mode.TEST;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status = Status.NOT_CONNECTED;

    private String keyId;
    private String keySecret;
    private String webhookSecret;
    private Instant connectedAt;

    public boolean isUsable() {
        return status == Status.ACTIVE && keyId != null && keySecret != null;
    }
}
