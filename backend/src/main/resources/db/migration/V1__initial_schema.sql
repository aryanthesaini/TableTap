-- =====================================================================
-- TableTap — initial schema
-- Conventions:
--   * UUID primary keys (gen_random_uuid(), PostgreSQL 13+)
--   * enumerations as varchar + CHECK (maps to JPA @Enumerated(STRING))
--   * money as numeric(12,2)
--   * every tenant-owned table carries restaurant_id
--   * soft delete (deleted_at) where historical rows reference the record
-- =====================================================================

-- ---------------------------------------------------------------------
-- Restaurant (tenant)
-- ---------------------------------------------------------------------
CREATE TABLE restaurant (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug              varchar(80)  NOT NULL,
    name              varchar(120) NOT NULL,
    description       varchar(500),
    cuisine           varchar(120),
    logo_url          varchar(500),
    cover_image_url   varchar(500),
    brand_color       varchar(7)   NOT NULL DEFAULT '#C2410C',
    address_line      varchar(255),
    city              varchar(80),
    state             varchar(80),
    postal_code       varchar(12),
    phone             varchar(20),
    email             varchar(160),
    status            varchar(20)  NOT NULL DEFAULT 'ACTIVE',
    accepting_orders  boolean      NOT NULL DEFAULT true,
    currency          varchar(3)      NOT NULL DEFAULT 'INR',
    tax_label         varchar(20)  NOT NULL DEFAULT 'GST',
    tax_rate_percent  numeric(5,2) NOT NULL DEFAULT 5.00,
    order_sequence    integer      NOT NULL DEFAULT 1000,
    created_at        timestamptz  NOT NULL DEFAULT now(),
    updated_at        timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_restaurant_slug UNIQUE (slug),
    CONSTRAINT ck_restaurant_status CHECK (status IN ('ACTIVE', 'SUSPENDED')),
    CONSTRAINT ck_restaurant_tax CHECK (tax_rate_percent >= 0 AND tax_rate_percent <= 100),
    CONSTRAINT ck_restaurant_slug CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

-- ---------------------------------------------------------------------
-- Users (restaurant owners/staff + platform admins)
-- ---------------------------------------------------------------------
CREATE TABLE app_user (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid REFERENCES restaurant (id),
    email          varchar(160) NOT NULL,
    password_hash  varchar(100) NOT NULL,
    full_name      varchar(120) NOT NULL,
    role           varchar(20)  NOT NULL,
    active         boolean      NOT NULL DEFAULT true,
    last_login_at  timestamptz,
    created_at     timestamptz  NOT NULL DEFAULT now(),
    updated_at     timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_app_user_role CHECK (role IN ('OWNER', 'STAFF', 'PLATFORM_ADMIN')),
    -- platform admins are not tenant users; every other user belongs to exactly one restaurant
    CONSTRAINT ck_app_user_tenant CHECK ((role = 'PLATFORM_ADMIN') = (restaurant_id IS NULL))
);
CREATE UNIQUE INDEX uq_app_user_email ON app_user (lower(email));
CREATE INDEX ix_app_user_restaurant ON app_user (restaurant_id);

-- ---------------------------------------------------------------------
-- Tables & QR tokens
-- ---------------------------------------------------------------------
CREATE TABLE restaurant_table (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id    uuid        NOT NULL REFERENCES restaurant (id),
    name             varchar(60) NOT NULL,
    seats            integer,
    qr_token         varchar(32) NOT NULL,
    qr_generated_at  timestamptz NOT NULL DEFAULT now(),
    active           boolean     NOT NULL DEFAULT true,
    sort_order       integer     NOT NULL DEFAULT 0,
    deleted_at       timestamptz,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_table_qr_token UNIQUE (qr_token),
    CONSTRAINT ck_table_seats CHECK (seats IS NULL OR seats BETWEEN 1 AND 50)
);
CREATE UNIQUE INDEX uq_table_name_per_restaurant
    ON restaurant_table (restaurant_id, lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX ix_table_restaurant ON restaurant_table (restaurant_id, sort_order);

-- ---------------------------------------------------------------------
-- Menu
-- ---------------------------------------------------------------------
CREATE TABLE menu_category (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid         NOT NULL REFERENCES restaurant (id),
    name           varchar(80)  NOT NULL,
    description    varchar(300),
    sort_order     integer      NOT NULL DEFAULT 0,
    deleted_at     timestamptz,
    created_at     timestamptz  NOT NULL DEFAULT now(),
    updated_at     timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_category_name_per_restaurant
    ON menu_category (restaurant_id, lower(name)) WHERE deleted_at IS NULL;
CREATE INDEX ix_category_restaurant ON menu_category (restaurant_id, sort_order);

CREATE TABLE menu_item (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid          NOT NULL REFERENCES restaurant (id),
    category_id    uuid          NOT NULL REFERENCES menu_category (id),
    name           varchar(120)  NOT NULL,
    description    varchar(500),
    price          numeric(12,2) NOT NULL,
    image_url      varchar(500),
    available      boolean       NOT NULL DEFAULT true,
    dietary        varchar(10),
    featured       boolean       NOT NULL DEFAULT false,
    sort_order     integer       NOT NULL DEFAULT 0,
    deleted_at     timestamptz,
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT ck_menu_item_price CHECK (price >= 0),
    CONSTRAINT ck_menu_item_dietary CHECK (dietary IS NULL OR dietary IN ('VEG', 'NON_VEG', 'EGG'))
);
CREATE INDEX ix_menu_item_restaurant_category ON menu_item (restaurant_id, category_id, sort_order);

-- ---------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------
CREATE TABLE payment_configuration (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   uuid         NOT NULL REFERENCES restaurant (id),
    provider        varchar(20)  NOT NULL DEFAULT 'RAZORPAY',
    mode            varchar(10)  NOT NULL DEFAULT 'TEST',
    status          varchar(20)  NOT NULL DEFAULT 'NOT_CONNECTED',
    key_id          varchar(80),
    -- NOTE: in production these must be encrypted at rest (KMS envelope encryption) — see docs.
    key_secret      varchar(200),
    webhook_secret  varchar(200),
    connected_at    timestamptz,
    created_at      timestamptz  NOT NULL DEFAULT now(),
    updated_at      timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_payment_configuration_restaurant UNIQUE (restaurant_id),
    CONSTRAINT ck_payment_configuration_mode CHECK (mode IN ('TEST', 'LIVE')),
    CONSTRAINT ck_payment_configuration_status CHECK (status IN ('NOT_CONNECTED', 'ACTIVE', 'DISABLED'))
);

-- A priced, server-side snapshot of the cart awaiting payment. Orders are only created from a
-- checkout session after the payment is captured.
CREATE TABLE checkout_session (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id  uuid          NOT NULL REFERENCES restaurant (id),
    table_id       uuid          NOT NULL REFERENCES restaurant_table (id),
    status         varchar(20)   NOT NULL DEFAULT 'OPEN',
    currency       varchar(3)       NOT NULL,
    subtotal       numeric(12,2) NOT NULL,
    tax_amount     numeric(12,2) NOT NULL,
    total_amount   numeric(12,2) NOT NULL,
    items          jsonb         NOT NULL,
    customer_note  varchar(300),
    created_at     timestamptz   NOT NULL DEFAULT now(),
    updated_at     timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT ck_checkout_status CHECK (status IN ('OPEN', 'COMPLETED', 'FAILED', 'EXPIRED'))
);
CREATE INDEX ix_checkout_restaurant ON checkout_session (restaurant_id, created_at);

CREATE TABLE payment (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id         uuid          NOT NULL REFERENCES restaurant (id),
    checkout_session_id   uuid          NOT NULL REFERENCES checkout_session (id),
    order_id              uuid,
    -- denormalised display reference so the payment module never needs to query orders
    order_number          integer,
    provider              varchar(20)   NOT NULL,
    provider_order_id     varchar(64)   NOT NULL,
    provider_payment_id   varchar(64),
    amount                numeric(12,2) NOT NULL,
    currency              varchar(3)       NOT NULL,
    status                varchar(20)   NOT NULL DEFAULT 'CREATED',
    method                varchar(20),
    failure_reason        varchar(255),
    captured_at           timestamptz,
    created_at            timestamptz   NOT NULL DEFAULT now(),
    updated_at            timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT uq_payment_provider_order UNIQUE (provider, provider_order_id),
    CONSTRAINT ck_payment_status CHECK (status IN ('CREATED', 'PENDING', 'CAPTURED', 'FAILED', 'REFUNDED')),
    CONSTRAINT ck_payment_amount CHECK (amount > 0)
);
CREATE UNIQUE INDEX uq_payment_provider_payment ON payment (provider, provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;
CREATE INDEX ix_payment_restaurant_created ON payment (restaurant_id, created_at DESC);
CREATE INDEX ix_payment_checkout ON payment (checkout_session_id);
CREATE INDEX ix_payment_status_created ON payment (status, created_at);

-- Webhook deliveries, recorded for idempotency and audit.
CREATE TABLE payment_webhook_event (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    provider     varchar(20)  NOT NULL,
    event_id     varchar(80)  NOT NULL,
    event_type   varchar(60)  NOT NULL,
    payload      jsonb        NOT NULL,
    received_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT uq_webhook_event UNIQUE (provider, event_id)
);

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
CREATE TABLE customer_order (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id        uuid          NOT NULL REFERENCES restaurant (id),
    table_id             uuid          NOT NULL REFERENCES restaurant_table (id),
    table_name           varchar(60)   NOT NULL,
    order_number         integer       NOT NULL,
    checkout_session_id  uuid          REFERENCES checkout_session (id),
    status               varchar(20)   NOT NULL DEFAULT 'PENDING',
    payment_status       varchar(20)   NOT NULL,
    currency             varchar(3)       NOT NULL,
    subtotal             numeric(12,2) NOT NULL,
    tax_amount           numeric(12,2) NOT NULL,
    total_amount         numeric(12,2) NOT NULL,
    customer_note        varchar(300),
    served_at            timestamptz,
    served_by            uuid REFERENCES app_user (id),
    created_at           timestamptz   NOT NULL DEFAULT now(),
    updated_at           timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT uq_order_number_per_restaurant UNIQUE (restaurant_id, order_number),
    CONSTRAINT uq_order_checkout_session UNIQUE (checkout_session_id),
    CONSTRAINT ck_order_status CHECK (status IN ('PENDING', 'SERVED')),
    CONSTRAINT ck_order_payment_status CHECK (payment_status IN ('CREATED', 'PENDING', 'CAPTURED', 'FAILED', 'REFUNDED'))
);
CREATE INDEX ix_order_restaurant_created ON customer_order (restaurant_id, created_at DESC);
CREATE INDEX ix_order_restaurant_status ON customer_order (restaurant_id, status, created_at DESC);
CREATE INDEX ix_order_restaurant_table ON customer_order (restaurant_id, table_id, created_at DESC);

ALTER TABLE payment ADD CONSTRAINT fk_payment_order FOREIGN KEY (order_id) REFERENCES customer_order (id);

CREATE TABLE order_item (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      uuid          NOT NULL REFERENCES customer_order (id) ON DELETE CASCADE,
    menu_item_id  uuid          REFERENCES menu_item (id),
    item_name     varchar(120)  NOT NULL,
    unit_price    numeric(12,2) NOT NULL,
    quantity      integer       NOT NULL,
    line_total    numeric(12,2) NOT NULL,
    dietary       varchar(10),
    CONSTRAINT ck_order_item_quantity CHECK (quantity > 0)
);
CREATE INDEX ix_order_item_order ON order_item (order_id);

-- ---------------------------------------------------------------------
-- AI menu onboarding
-- ---------------------------------------------------------------------
CREATE TABLE menu_upload (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id      uuid         NOT NULL REFERENCES restaurant (id),
    original_filename  varchar(255) NOT NULL,
    content_type       varchar(100) NOT NULL,
    file_size          bigint       NOT NULL,
    file_key           varchar(500) NOT NULL,
    file_url           varchar(500) NOT NULL,
    status             varchar(20)  NOT NULL DEFAULT 'PROCESSING',
    extraction_provider varchar(40),
    error_message      varchar(500),
    uploaded_by        uuid REFERENCES app_user (id),
    published_at       timestamptz,
    published_item_count integer,
    created_at         timestamptz  NOT NULL DEFAULT now(),
    updated_at         timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT ck_menu_upload_status CHECK (status IN ('PROCESSING', 'READY_FOR_REVIEW', 'PUBLISHED', 'DISCARDED', 'FAILED'))
);
CREATE INDEX ix_menu_upload_restaurant ON menu_upload (restaurant_id, created_at DESC);

CREATE TABLE menu_draft_item (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id         uuid          NOT NULL REFERENCES menu_upload (id) ON DELETE CASCADE,
    restaurant_id     uuid          NOT NULL REFERENCES restaurant (id),
    category_name     varchar(80)   NOT NULL,
    name              varchar(120)  NOT NULL,
    description       varchar(500),
    price             numeric(12,2),
    dietary           varchar(10),
    confidence        numeric(3,2)  NOT NULL DEFAULT 1.00,
    uncertain_fields  jsonb         NOT NULL DEFAULT '[]'::jsonb,
    included          boolean       NOT NULL DEFAULT true,
    sort_order        integer       NOT NULL DEFAULT 0,
    created_at        timestamptz   NOT NULL DEFAULT now(),
    updated_at        timestamptz   NOT NULL DEFAULT now(),
    CONSTRAINT ck_draft_dietary CHECK (dietary IS NULL OR dietary IN ('VEG', 'NON_VEG', 'EGG')),
    CONSTRAINT ck_draft_price CHECK (price IS NULL OR price >= 0)
);
CREATE INDEX ix_menu_draft_item_upload ON menu_draft_item (upload_id, sort_order);
