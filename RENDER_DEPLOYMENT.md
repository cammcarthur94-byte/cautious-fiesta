# Deploying to Render (Step-by-Step Guide)

This Next.js Shopify App is pre-configured and ready for one-click or manual deployment to [Render.com](https://render.com).

---

## Option 1: Automatic Blueprint Deployment (Recommended)

1. Push your repository to GitHub or GitLab.
2. In the **Render Dashboard**, click **New +** → **Blueprint**.
3. Connect your repository. Render will automatically detect [`render.yaml`](./render.yaml) and configure:
   - **Runtime:** Node.js (20.x)
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Health Check Path:** `/api/health`
4. Fill in your environment variables in the Render Dashboard (see list below).
5. Click **Apply**.

---

## Option 2: Manual Web Service Setup on Render

1. Go to **Render Dashboard** → **New +** → **Web Service**.
2. Select your repository.
3. Configure the following settings:
   - **Environment:** `Node`
   - **Node Version:** `20.18.0` (set via `NODE_VERSION` environment variable)
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Health Check Path:** `/api/health`
   - **Auto-Deploy:** `Yes`
4. Add the Environment Variables below.

---

## Required Environment Variables on Render

| Variable | Description | Example |
|---|---|---|
| `SHOPIFY_API_KEY` | Client ID from Shopify Partner Dashboard | `6f38a...` |
| `SHOPIFY_API_SECRET` | Client Secret from Shopify Partner Dashboard | `shpss_...` |
| `SHOPIFY_APP_URL` | Your Render public URL (without trailing slash) | `https://shopify-geo-optimizer.onrender.com` |
| `SCOPES` | Shopify API scopes | `read_products,write_products,read_metafields,write_metafields,read_themes,write_themes` |
| `GEMINI_API_KEY` | Google Gemini API Key (Gemini 2.5 Flash) | `AIzaSy...` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key | `eyJhb...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | `eyJhb...` |
| `CRON_SECRET` | Secret token for Vercel / Render Cron API security | `any_random_secure_string` |
| `NEXT_PUBLIC_DEMO_MODE` | Set to `false` in production (or `true` for demo) | `false` |

---

## Post-Deployment: Configure Shopify Partner Dashboard

Once your Render app is deployed and you have your live `https://your-service.onrender.com` URL:

1. Open the [Shopify Partner Dashboard](https://partners.shopify.com).
2. Go to **Apps** → Select your App → **App Setup**.
3. Update **App URL** to:
   ```
   https://your-service.onrender.com
   ```
4. Update **Allowed redirection URL(s)** to:
   ```
   https://your-service.onrender.com/api/auth/callback
   ```
5. Save changes.

---

## Health Check & Monitoring
- **Health Check Endpoint:** `https://your-service.onrender.com/api/health`
- Render uses this endpoint for zero-downtime rolling deploys and automatic restarts.
