# Shopify AI Search & Answer Engine Optimizer (GEO / AEO / AIO)

Production-ready Next.js Shopify Embedded Application designed to audit store product catalogs, compute Generative Engine Optimization (GEO), Answer Engine Optimization (AEO), and AI Overview (AIO) schema scores using Google Gemini AI, and publish automated JSON-LD and content fixes.

---

## 🚀 Environment Variables Configuration (`.env.local`)

Copy `.env.example` to `.env.local` and populate the required credentials:

```bash
# Shopify App Credentials (Partner Dashboard)
SHOPIFY_API_KEY=015d247c50edff1cc10be4e8a63e43b8
NEXT_PUBLIC_SHOPIFY_API_KEY=015d247c50edff1cc10be4e8a63e43b8
SHOPIFY_API_SECRET=your_shopify_api_secret
SHOPIFY_APP_URL=https://your-tunnel-or-domain.ngrok-free.app
SCOPES=read_products,write_products,read_metafields,write_metafields

# Google Gemini API Credentials
GEMINI_API_KEY=AQ.Ab8RN6IZSfMRq8dNCs8hcsns16udxs9s2QbSetz__8ugLhFbmg

# Supabase Credentials (Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://eyszluwtkldzkxcntrvm.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_yDRLY5Eg_8TLxfNy-2_t2Q_iBRNmd-3
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_yDRLY5Eg_8TLxfNy-2_t2Q_iBRNmd-3
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# PostgreSQL Connection String
DATABASE_URL=postgresql://postgres:J6kUCgSdxP04F1CW@db.eyszluwtkldzkxcntrvm.supabase.co:5432/postgres
POSTGRES_URL=postgresql://postgres:J6kUCgSdxP04F1CW@db.eyszluwtkldzkxcntrvm.supabase.co:5432/postgres

# Cron Worker Security Secret
CRON_SECRET=your_cron_secret_token

# Demo Mode (Set to false for live Shopify Admin & Supabase API operations)
NEXT_PUBLIC_DEMO_MODE=false
```

---

## 🛠️ Shopify Partner Dashboard Setup

1. Log into your [Shopify Partner Dashboard](https://partners.shopify.com/).
2. Navigate to **Apps** → Select your app → **Configuration**.
3. Set **App URL**: `https://your-domain.com` (or your active tunnel URL).
4. Set **Allowed redirection URL(s)**:
   - `https://your-domain.com/api/auth/callback`
   - `https://your-domain.com/api/auth`
5. Under **Access Scopes**, request:
   - `read_products, write_products, read_metafields, write_metafields`

---

## 🗄️ Supabase Database Migration Setup

1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Open the **SQL Editor** for your project.
3. Open [`src/lib/supabase/production_migration.sql`](file:///c:/Users/cammc/OneDrive/Desktop/Shopify_app/src/lib/supabase/production_migration.sql) from this repository.
4. Paste the entire SQL script into the editor and click **Run**.

This initializes the required 5 core tables, indexes, triggers, and atomic usage counter procedures:
- `shops`: Multi-tenant installation, settings, active plan (`FREE`, `BASIC`, `PRO`), monthly usage counter, and readiness score.
- `products`: Catalog cache with unique constraint on `(shop_id, shopify_product_id)`.
- `product_scores`: Historical and active GEO, AEO, and AIO pillar breakdown scores.
- `recommendations`: Actionable AI descriptions, structured FAQs, and rich JSON-LD markup.
- `audit_queue`: Background worker queue with Dead Letter Queue retry tracking (`retry_count`).

---

## 🏃 Local Development & Build Verification

```bash
# Install dependencies
npm install

# Run type check
npx tsc --noEmit

# Start Next.js development server
npm run dev
```

Visit `http://localhost:3000` in your browser.
