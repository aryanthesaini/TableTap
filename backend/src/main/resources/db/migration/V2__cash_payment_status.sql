-- Add CASH to the allowed payment status values in both tables.
ALTER TABLE payment
    DROP CONSTRAINT ck_payment_status,
    ADD CONSTRAINT ck_payment_status CHECK (status IN ('CREATED', 'PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'CASH'));

ALTER TABLE customer_order
    DROP CONSTRAINT ck_order_payment_status,
    ADD CONSTRAINT ck_order_payment_status CHECK (payment_status IN ('CREATED', 'PENDING', 'CAPTURED', 'FAILED', 'REFUNDED', 'CASH'));
