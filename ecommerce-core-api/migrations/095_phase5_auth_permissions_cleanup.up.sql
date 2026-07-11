CREATE TABLE customer_otps (
    id UUID PRIMARY KEY,
    store_id UUID NOT NULL,
    identifier VARCHAR(255) NOT NULL, -- phone or email
    otp_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_otps_store_identifier ON customer_otps(store_id, identifier);
