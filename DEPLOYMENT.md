# Quest-Finder Deployment Guide

## Prerequisites

Before deploying, you'll need accounts and credentials for:

1. **Vercel** - Hosting platform
2. **PostgreSQL Database** - Vercel Postgres, Neon, Supabase, or similar
3. **Stripe** - Payment processing
4. **SAM.gov** - Government contract API access
5. **Inngest** - Background job processing

## Step 1: Database Setup

### Option A: Vercel Postgres (Recommended)
1. Go to your Vercel project dashboard
2. Navigate to Storage → Create Database → Postgres
3. Copy the `DATABASE_URL` from the connection details

### Option B: Neon or Supabase
1. Create a new PostgreSQL database
2. Get the connection string (must support connection pooling for serverless)

## Step 2: Stripe Setup

1. Create a Stripe account at https://stripe.com
2. Get your API keys from Dashboard → Developers → API Keys:
   - `STRIPE_SECRET_KEY` (starts with `sk_test_` or `sk_live_`)
   - `STRIPE_PUBLISHABLE_KEY` (starts with `pk_test_` or `pk_live_`)

3. Create subscription products and prices:
   - Go to Products → Add Product
   - Create 3 products: Basic ($29/mo), Pro ($79/mo), Enterprise ($199/mo)
   - Copy the Price IDs for each (starts with `price_`)

4. Set up the webhook:
   - Go to Developers → Webhooks → Add Endpoint
   - URL: `https://your-domain.vercel.app/api/stripe/webhook`
   - Events to listen for:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Copy the `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`)

## Step 3: SAM.gov API Key

1. Register at https://sam.gov
2. Request API access at https://open.gsa.gov/api/
3. Get your API key for the Opportunities API

## Step 4: Inngest Setup

1. Create an account at https://inngest.com
2. Create a new app
3. Get your keys:
   - `INNGEST_SIGNING_KEY` (for webhook verification)
   - `INNGEST_EVENT_KEY` (for sending events)

## Step 5: Deploy to Vercel

### Via Vercel Dashboard:

1. Import your GitHub repository at https://vercel.com/new
2. Configure the project:
   - Framework: Next.js
   - Build Command: `prisma generate && next build`
   - Install Command: `npm install`

3. Add Environment Variables (Settings → Environment Variables):

```
# Required
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>

# SAM.gov
SAM_GOV_API_KEY=your-api-key
SAM_GOV_API_URL=https://api.sam.gov/opportunities/v2/search

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_BASIC=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...

# Inngest
INNGEST_SIGNING_KEY=signkey-...
INNGEST_EVENT_KEY=...
```

4. Deploy!

### Via Vercel CLI:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

## Step 6: Post-Deployment

### Run Database Migrations

After first deployment, run migrations:

```bash
# Option 1: Via Vercel CLI
vercel env pull .env.local
npx prisma migrate deploy

# Option 2: Via Vercel dashboard
# Go to Settings → Functions → Run: npx prisma migrate deploy
```

### Seed Initial Data (Optional)

```bash
npx prisma db seed
```

### Configure Inngest

1. Go to https://app.inngest.com
2. Register your app's Inngest endpoint:
   - URL: `https://your-domain.vercel.app/api/inngest`
3. Verify the connection shows "Connected"

### Update Stripe Webhook URL

If you used a placeholder during setup, update the webhook endpoint URL to your production domain.

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes | Your app's base URL |
| `NEXTAUTH_SECRET` | Yes | Random secret for session encryption |
| `SAM_GOV_API_KEY` | Yes | SAM.gov API key |
| `SAM_GOV_API_URL` | No | SAM.gov API endpoint (has default) |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret API key |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `STRIPE_PRICE_BASIC` | Yes | Stripe Price ID for Basic plan |
| `STRIPE_PRICE_PRO` | Yes | Stripe Price ID for Pro plan |
| `STRIPE_PRICE_ENTERPRISE` | Yes | Stripe Price ID for Enterprise plan |
| `INNGEST_SIGNING_KEY` | Yes | Inngest signing key |
| `INNGEST_EVENT_KEY` | Yes | Inngest event key |
| `REDIS_URL` | No | Redis URL for caching (optional) |

## Troubleshooting

### Build Fails with Prisma Error
Make sure your build command is `prisma generate && next build`

### Database Connection Issues
- Ensure your database allows connections from Vercel's IP ranges
- Use connection pooling (PgBouncer) for serverless compatibility

### Stripe Webhooks Not Working
- Verify the webhook URL is correct
- Check the webhook signing secret matches
- Ensure all required events are selected

### Inngest Jobs Not Running
- Verify the Inngest endpoint is accessible
- Check the signing key is correct
- View logs at https://app.inngest.com

## Monitoring

- **Vercel**: View deployments and logs at https://vercel.com
- **Inngest**: Monitor background jobs at https://app.inngest.com
- **Stripe**: View payments and webhooks at https://dashboard.stripe.com
