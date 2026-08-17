-- ==============================================================================
-- Supabase Database Migration Script for Shopify AI Search Optimizer
-- Feature: Multi-tenant Shops, Tiered Billing, Catalog Cache, Scores, Recommendations & Batch Queue
-- ==============================================================================

-- Enable pgcrypto extension for UUID generation if needed
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
-- Tracks merchant installation, settings, and subscription states.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS shops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT UNIQUE NOT NULL,
    access_token TEXT,
    is_installed BOOLEAN NOT NULL DEFAULT true,
    active_plan TEXT NOT NULL DEFAULT 'FREE' CHECK (active_plan IN ('FREE', 'BASIC', 'PRO')),
    shopify_subscription_id TEXT,
    billing_cycle_end TIMESTAMPTZ,
    optimizations_used_this_month INTEGER NOT NULL DEFAULT 0,
    overall_ai_readiness_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to automatically update `updated_at` on `shops`
DROP TRIGGER IF EXISTS trg_shops_updated_at ON shops;
CREATE TRIGGER trg_shops_updated_at
    BEFORE UPDATE ON shops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 3. `products` Table
-- Caches store catalog data synced via the Shopify Admin API.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    shopify_product_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    handle TEXT NOT NULL,
    body_html TEXT,
    status TEXT DEFAULT 'active',
    current_json_ld JSONB,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_shop_shopify_product UNIQUE (shop_id, shopify_product_id)
);

-- ==============================================================================
-- 4. `product_scores` Table
-- Stores historical and current GEO, AEO, and AIO breakdown scores evaluated by Gemini.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS product_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    geo_score NUMERIC(5,2) NOT NULL,
    aeo_score NUMERIC(5,2) NOT NULL,
    aio_score NUMERIC(5,2) NOT NULL,
    overall_score NUMERIC(5,2) NOT NULL,
    scoring_breakdown JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 5. `recommendations` Table
-- Stores generated fixes, FAQs, and JSON-LD schemas pending merchant approval.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    suggested_description TEXT,
    structured_faqs JSONB DEFAULT '[]'::jsonb,
    generated_json_ld JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'dismissed')),
    applied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 6. `audit_queue` Table
-- Manages background batch processing for large catalog audits to prevent API rate limits.
-- ==============================================================================
CREATE TABLE IF NOT EXISTS audit_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    CONSTRAINT unique_shop_product_queue UNIQUE (shop_id, product_id)
);

-- ==============================================================================
-- 7. Indexes & Performance Optimization
-- ==============================================================================
-- Index `shops(shop_domain)` for fast OAuth lookups
CREATE INDEX IF NOT EXISTS idx_shops_shop_domain ON shops(shop_domain);

-- Index `products(shop_id, shopify_product_id)` for catalog queries
CREATE INDEX IF NOT EXISTS idx_products_shop_shopify_prod ON products(shop_id, shopify_product_id);

-- Index `audit_queue(status, created_at)` for background worker polling
CREATE INDEX IF NOT EXISTS idx_audit_queue_status_created ON audit_queue(status, created_at);

-- Additional Foreign Key indexes for optimal query join performance
CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_product_scores_product_id ON product_scores(product_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_product_id ON recommendations(product_id);
CREATE INDEX IF NOT EXISTS idx_audit_queue_shop_id ON audit_queue(shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_queue_product_id ON audit_queue(product_id);

-- ==============================================================================
-- 8. Stored Atomic Functions
-- ==============================================================================
-- Function to atomically increment monthly usage limit counter for a shop
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
