-- Supabase Schema for AI Search & Answer Engine Optimization (GEO/AEO/AIO) Shopify App

-- 1. Stores / Installations Table
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT UNIQUE NOT NULL,
    access_token TEXT NOT NULL,
    scope TEXT NOT NULL,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Products Cache Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT NOT NULL,
    shopify_product_id TEXT NOT NULL,
    title TEXT NOT NULL,
    handle TEXT NOT NULL,
    body_html TEXT,
    vendor TEXT,
    product_type TEXT,
    status TEXT DEFAULT 'active',
    image_url TEXT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_domain, shopify_product_id)
);

-- 3. Product Audits & Scores Table
CREATE TABLE IF NOT EXISTS product_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT NOT NULL,
    shopify_product_id TEXT NOT NULL,
    overall_score INT NOT NULL DEFAULT 0,
    geo_score INT NOT NULL DEFAULT 0,
    aeo_score INT NOT NULL DEFAULT 0,
    aio_score INT NOT NULL DEFAULT 0,
    issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendations JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_description TEXT,
    generated_faqs JSONB DEFAULT '[]'::jsonb,
    generated_jsonld JSONB DEFAULT '{}'::jsonb,
    published_at TIMESTAMPTZ,
    audited_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by shop and product
CREATE INDEX IF NOT EXISTS idx_product_audits_shop_prod ON product_audits (shop_domain, shopify_product_id);
CREATE INDEX IF NOT EXISTS idx_products_shop ON products (shop_domain);

-- 4. Audit Queue / Background Jobs Table
CREATE TABLE IF NOT EXISTS audit_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    total_products INT DEFAULT 0,
    processed_products INT DEFAULT 0,
    failed_products INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Product Revision Backups Table (Rollback Safety)
CREATE TABLE IF NOT EXISTS product_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_domain TEXT NOT NULL,
    shopify_product_id TEXT NOT NULL,
    previous_body_html TEXT NOT NULL,
    previous_jsonld JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_revisions_shop_prod ON product_revisions (shop_domain, shopify_product_id);

-- 6. Subscriptions & Billing Usage Limits Table
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_shop ON subscriptions(shop_domain);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(active_plan);

