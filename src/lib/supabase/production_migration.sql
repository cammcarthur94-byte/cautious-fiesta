-- ==============================================================================
-- Complete Supabase Production Migration Script for Shopify AI Search Optimizer
-- Includes: Column Backfills + Drop & Recreate for 100% Conflict-Free Execution
-- ==============================================================================

-- Enable pgcrypto extension for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing indexes to prevent column missing errors during table modifications
DROP INDEX IF EXISTS idx_shops_shop_domain CASCADE;
DROP INDEX IF EXISTS idx_stores_shop_domain CASCADE;
DROP INDEX IF EXISTS idx_products_shop_shopify_prod CASCADE;
DROP INDEX IF EXISTS idx_products_shop_domain CASCADE;
DROP INDEX IF EXISTS idx_product_audits_shopify_prod CASCADE;
DROP INDEX IF EXISTS idx_audit_queue_status_created CASCADE;
DROP INDEX IF EXISTS idx_audit_queue_shop_id CASCADE;
DROP INDEX IF EXISTS idx_product_revisions_shopify_prod CASCADE;

-- Safe Column Backfills in case legacy tables exist in Supabase
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'products') THEN
        ALTER TABLE products ADD COLUMN IF NOT EXISTS shop_domain TEXT;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shops') THEN
        ALTER TABLE shops ADD COLUMN IF NOT EXISTS shop_domain TEXT;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'stores') THEN
        ALTER TABLE stores ADD COLUMN IF NOT EXISTS shop_domain TEXT;
    END IF;
END $$;

-- Drop existing tables with CASCADE to guarantee fresh, exact schema definitions
DROP TABLE IF EXISTS audit_queue CASCADE;
DROP TABLE IF EXISTS product_revisions CASCADE;
DROP TABLE IF EXISTS recommendations CASCADE;
DROP TABLE IF EXISTS product_scores CASCADE;
DROP TABLE IF EXISTS product_audits CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS shops CASCADE;

-- ==============================================================================
-- 1. Helper Trigger Function for `updated_at` Timestamps
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 2. `shops` Table
-- Tracks merchant installation, settings, active plan, and usage counters.
-- ==============================================================================
CREATE TABLE shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT UNIQUE NOT NULL,
    access_token TEXT,
    is_installed BOOLEAN NOT NULL DEFAULT true,
    plan_name TEXT NOT NULL DEFAULT 'free',
    active_plan TEXT NOT NULL DEFAULT 'FREE',
    shopify_subscription_id TEXT,
    billing_cycle_end TIMESTAMPTZ,
    optimizations_used_this_month INTEGER NOT NULL DEFAULT 0,
    overall_ai_readiness_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for `updated_at` on `shops`
DROP TRIGGER IF EXISTS trg_shops_updated_at ON shops;
CREATE TRIGGER trg_shops_updated_at
    BEFORE UPDATE ON shops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 3. `stores` Table (Session Compatibility Store)
-- ==============================================================================
CREATE TABLE stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    scope TEXT,
    installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. `products` Table
-- Caches store catalog data synced via the Shopify Admin API.
-- ==============================================================================
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    shop_domain TEXT,
    shopify_product_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    handle TEXT NOT NULL,
    body_html TEXT,
    vendor TEXT,
    product_type TEXT,
    status TEXT DEFAULT 'active',
    image_url TEXT,
    current_json_ld JSONB,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_shop_shopify_product UNIQUE (shop_id, shopify_product_id)
);

-- ==============================================================================
-- 5. `product_audits` Table
-- Caches store audit results and multi-engine breakdown metrics.
-- ==============================================================================
CREATE TABLE product_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT NOT NULL,
    shopify_product_id BIGINT UNIQUE NOT NULL,
    overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    geo_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    aeo_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    aio_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    issues JSONB DEFAULT '[]'::jsonb,
    recommendations JSONB DEFAULT '{}'::jsonb,
    engine_breakdown JSONB DEFAULT '{}'::jsonb,
    published_at TIMESTAMPTZ,
    audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. `product_scores` Table
-- Historical GEO, AEO, and AIO breakdown scores evaluated by Gemini.
-- ==============================================================================
CREATE TABLE product_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    geo_score NUMERIC(5,2) NOT NULL,
    aeo_score NUMERIC(5,2) NOT NULL,
    aio_score NUMERIC(5,2) NOT NULL,
    overall_score NUMERIC(5,2) NOT NULL,
    scoring_breakdown JSONB DEFAULT '{}'::jsonb,
    engine_breakdown JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 7. `recommendations` Table
-- Generated fixes, FAQs, and JSON-LD schemas pending merchant approval.
-- ==============================================================================
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    suggested_description TEXT,
    structured_faqs JSONB DEFAULT '[]'::jsonb,
    generated_json_ld JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 8. `audit_queue` Table
-- Manages background batch processing for catalog audits.
-- ==============================================================================
CREATE TABLE audit_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT unique_shop_product_queue UNIQUE (shop_id, product_id)
);

-- ==============================================================================
-- 9. `product_revisions` Table
-- Product revision history for 1-click restore functionality.
-- ==============================================================================
CREATE TABLE product_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT NOT NULL,
    shopify_product_id BIGINT NOT NULL,
    previous_body_html TEXT,
    previous_jsonld JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 10. Performance Indexes
-- ==============================================================================
CREATE INDEX idx_shops_shop_domain ON shops(shop_domain);
CREATE INDEX idx_stores_shop_domain ON stores(shop_domain);
CREATE INDEX idx_products_shop_shopify_prod ON products(shop_id, shopify_product_id);
CREATE INDEX idx_products_shop_domain ON products(shop_domain);
CREATE INDEX idx_product_audits_shopify_prod ON product_audits(shopify_product_id);
CREATE INDEX idx_audit_queue_status_created ON audit_queue(status, created_at);
CREATE INDEX idx_audit_queue_shop_id ON audit_queue(shop_id);
CREATE INDEX idx_product_revisions_shopify_prod ON product_revisions(shopify_product_id);

-- ==============================================================================
-- 11. Stored Atomic Functions
-- ==============================================================================
CREATE OR REPLACE FUNCTION increment_optimization_usage(target_shop_id UUID)
RETURNS INTEGER AS $$
DECLARE
    new_count INTEGER;
BEGIN
    UPDATE shops
    SET optimizations_used_this_month = optimizations_used_this_month + 1,
        updated_at = NOW()
    WHERE id = target_shop_id
    RETURNING optimizations_used_this_month INTO new_count;
    
    RETURN new_count;
END;
$$ LANGUAGE plpgsql;
