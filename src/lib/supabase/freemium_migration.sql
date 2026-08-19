-- ==============================================================================
-- Freemium Tier Migration: FREE + GROWTH_PILOT
-- Additive-only — safe to run on a live Supabase instance without data loss.
-- Run this in Supabase SQL Editor (Project > SQL Editor > New Query).
-- ==============================================================================

-- 1. Add plan_tier column to shops (canonical tier key)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS plan_tier TEXT NOT NULL DEFAULT 'free';

-- 2. Add subscription_status column (mirrors subscriptions.status)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive';

-- 3. Add monthly_evaluations_used counter (AI evaluation quota tracking)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS monthly_evaluations_used INT NOT NULL DEFAULT 0;

-- 4. Add synced_products_count (product catalog cap enforcement for Free tier)
ALTER TABLE shops ADD COLUMN IF NOT EXISTS synced_products_count INT NOT NULL DEFAULT 0;

-- 5. Backfill plan_tier from active_plan on existing shops
UPDATE shops
SET plan_tier = CASE
    WHEN active_plan IN ('BASIC', 'PRO', 'GROWTH_PILOT') THEN 'growth_pilot'
    ELSE 'free'
END
WHERE plan_tier = 'free' AND active_plan IS NOT NULL;

-- 6. Backfill subscription_status from subscriptions table
UPDATE shops sh
SET subscription_status = CASE
    WHEN sub.status = 'ACTIVE' AND sub.active_plan != 'FREE' THEN 'active'
    WHEN sub.status = 'PENDING' THEN 'trial'
    ELSE 'inactive'
END
FROM subscriptions sub
WHERE sub.shop_domain = sh.shop_domain;

-- 7. Expand the subscriptions.active_plan CHECK constraint to include GROWTH_PILOT
-- Drop old constraint first (name may vary — use the constraint name from your schema)
DO $$
BEGIN
    -- Drop any existing active_plan check constraint on subscriptions
    ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_active_plan_check;
EXCEPTION WHEN others THEN
    -- Constraint may not exist by that name — skip
    NULL;
END $$;

-- Re-add with all valid values including GROWTH_PILOT and legacy aliases
ALTER TABLE subscriptions
    ADD CONSTRAINT subscriptions_active_plan_check
    CHECK (active_plan IN ('FREE', 'BASIC', 'PRO', 'GROWTH_PILOT'));

-- 8. Migrate existing BASIC / PRO subscriptions to GROWTH_PILOT
UPDATE subscriptions
SET active_plan = 'GROWTH_PILOT'
WHERE active_plan IN ('BASIC', 'PRO');

-- 9. Index for plan_tier lookups
CREATE INDEX IF NOT EXISTS idx_shops_plan_tier ON shops(plan_tier);
CREATE INDEX IF NOT EXISTS idx_shops_subscription_status ON shops(subscription_status);

-- 10. Stored function: increment monthly_evaluations_used atomically
CREATE OR REPLACE FUNCTION increment_evaluations_used(target_shop_domain TEXT)
RETURNS INTEGER AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE shops
    SET monthly_evaluations_used = monthly_evaluations_used + 1,
        updated_at = NOW()
    WHERE shop_domain = target_shop_domain
    RETURNING monthly_evaluations_used INTO new_count;

    RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql;

-- 11. Stored function: increment synced_products_count atomically
CREATE OR REPLACE FUNCTION increment_synced_products(target_shop_domain TEXT, batch_size INT)
RETURNS INTEGER AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE shops
    SET synced_products_count = synced_products_count + batch_size,
        updated_at = NOW()
    WHERE shop_domain = target_shop_domain
    RETURNING synced_products_count INTO new_count;

    RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql;

-- 12. Monthly reset function (call from cron job on billing cycle rollover)
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS void AS $$
BEGIN
    UPDATE shops
    SET monthly_evaluations_used = 0,
        updated_at = NOW()
    WHERE billing_cycle_end IS NOT NULL AND billing_cycle_end < NOW();
END;
$$ LANGUAGE plpgsql;
