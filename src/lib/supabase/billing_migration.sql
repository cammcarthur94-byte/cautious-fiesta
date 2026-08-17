-- Migration: Add Subscriptions and Usage Tracking for Tiered Billing
-- Tier Limits: FREE (5/month), BASIC (1,000/month), PRO (10,000/month)

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT UNIQUE NOT NULL REFERENCES stores(shop_domain) ON DELETE CASCADE,
    active_plan TEXT NOT NULL DEFAULT 'FREE' CHECK (active_plan IN ('FREE', 'BASIC', 'PRO')),
    billing_cycle_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    optimizations_used_this_month INT NOT NULL DEFAULT 0,
    shopify_subscription_id TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CANCELLED', 'DECLINED', 'EXPIRED', 'FROZEN', 'PENDING')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_shop ON subscriptions(shop_domain);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(active_plan);

-- Automatic function to touch updated_at
CREATE OR REPLACE FUNCTION update_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_subscription_timestamp();
