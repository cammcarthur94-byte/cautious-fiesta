# Deploying to Netlify (Step-by-Step Guide)

This Next.js Shopify App is pre-configured and ready for deployment to [Netlify](https://www.netlify.com).

---

## 1. Prerequisites
- A **GitHub / GitLab / Bitbucket** repository with your app code pushed.
- A **Netlify** account ([netlify.com](https://app.netlify.com)).
- A **Shopify Partner Dashboard** account ([partners.shopify.com](https://partners.shopify.com)).
- A **Supabase** project for your production database ([supabase.com](https://supabase.com)).
- A **Google Gemini API** key.

---

## 2. Deploying via Netlify Dashboard

1. Log in to [Netlify](https://app.netlify.com).
2. Click **"Add new site"** → **"Import an existing project"**.
3. Choose your Git provider (GitHub) and select your repository: `Shopify_app`.
4. Netlify will auto-detect Next.js and apply the settings from [`netlify.toml`](./netlify.toml):
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - **Node.js version:** `20` (configured in `netlify.toml`)
5. Before clicking Deploy, expand **"Environment variables"** (or add them right after creation under **Site configuration** → **Environment variables**).

---

## 3. Required Environment Variables on Netlify

Add the following environment variables in **Site configuration** → **Environment variables**:

| Variable | Description | Example / Value |
|---|---|---|
| `SHOPIFY_API_KEY` | Client ID from Shopify Partner Dashboard | `6f38a9...` |
| `SHOPIFY_API_SECRET` | Client Secret from Shopify Partner Dashboard | `shpss_...` |
| `SHOPIFY_APP_URL` | Your Netlify site URL (without trailing slash) | `https://your-site-name.netlify.app` |
| `SCOPES` | Access Scopes needed by the app | `read_products,write_products,read_metafields,write_metafields,read_themes,write_themes` |
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Public / Anon API Key | `eyJhb...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key | `eyJhb...` |
| `CRON_SECRET` | Secret token for securing cron/worker endpoints | `any_random_secure_token_string` |
| `NEXT_PUBLIC_DEMO_MODE` | Set to `false` in production (or `true` for demo UI) | `false` |

> [!TIP]
> After saving environment variables on Netlify, trigger a **"Clear cache and deploy site"** in **Deploys** so the build picks up all variables.

---

## 4. Supabase Database Setup

If you haven't yet run the database migration for your production Supabase project:
1. Open your Supabase Project Dashboard → **SQL Editor**.
2. Run the SQL script from [`src/lib/supabase/production_migration.sql`](./src/lib/supabase/production_migration.sql).
3. This creates all necessary tables (`shops`, `products`, `audit_logs`, `fix_jobs`, etc.) and indexes.

---

## 5. Configure Shopify Partner Dashboard

Once your Netlify app is deployed and you have your live URL (e.g. `https://your-site-name.netlify.app` or your custom domain):

1. Go to [Shopify Partner Dashboard](https://partners.shopify.com) → **Apps** → select your app.
2. Under **Configuration** / **App Setup**:
   - **App URL**:
     ```
     https://your-site-name.netlify.app
     ```
   - **Allowed redirection URL(s)**:
     ```
     https://your-site-name.netlify.app/api/auth/callback
     ```
3. Save your changes.

---

## 6. Background Workers & Scheduled Audits

Netlify deploys your Next.js app as serverless edge/lambda functions. To run periodic audits and background processing on Netlify:
- **Queue Worker Endpoint:** `https://your-site-name.netlify.app/api/worker/process-queue`
- **Re-Audit Endpoint:** `https://your-site-name.netlify.app/api/cron/re-audit`
- **Weekly Audit Endpoint:** `https://your-site-name.netlify.app/api/cron/weekly-audit`

You can trigger these endpoints automatically using any free cron service (such as [cron-job.org](https://cron-job.org) or GitHub Actions) by sending an `Authorization: Bearer <CRON_SECRET>` header.

---

## 7. Verifying Deployment

1. Visit `https://your-site-name.netlify.app/api/health` to confirm the backend status.
2. In Shopify Partner Dashboard, click **"Test your app"** → select your development store.
3. Verify that the app embeds properly inside Shopify Admin and that the CSP iframe headers work seamlessly.
