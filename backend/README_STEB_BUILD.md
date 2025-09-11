# STEB.IO – Build & Deploy Runbook (Next.js 14 + Prisma + Stripe Connect)

This guide gets **steb.io** running in production with public browsing (no login required) and creator payouts via **Stripe Connect**.

## 1) Prereqs
- Node.js >= 20, pnpm
- GitHub repo: `steb94/stebio` (branch: `main`)
- Postgres (Neon or Supabase)
- Stripe account with Connect (Express)

## 2) Install
```bash
pnpm i
pnpm -w dlx prisma generate
```

## 3) Environment Variables
Create environment variables in your host (Vercel recommended):
- NEXT_PUBLIC_SITE_NAME
- NEXT_PUBLIC_APP_URL
- DATABASE_URL
- NEXTAUTH_URL
- NEXTAUTH_SECRET
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_CONNECT_CLIENT_ID

See `.env.example` for names.

## 4) Database
1. Create a Postgres DB in Neon/Supabase and copy the `DATABASE_URL` (SSL required).
2. Run migrations + seed:
```bash
pnpm -w dlx prisma migrate deploy
pnpm -w ts-node prisma/seed.ts
```

## 5) Stripe Connect
- Webhook endpoint: `https://steb.io/api/stripe/webhook`
- Events: `checkout.session.completed`, `payment_intent.succeeded`, `account.updated`, `transfer.created`, `charge.succeeded`
- Redirects:
  - Onboarding return: `https://steb.io/creator/complete`
  - Cancel: `https://steb.io/creator/start`

## 6) Build & Run
```bash
pnpm -w build
pnpm -w start
```

## 7) Deploy (Vercel)
- Import repo `steb94/stebio`
- Set environment variables
- Map domain `steb.io` to Vercel (DNS per Vercel instructions)

## 8) After Launch Checklist
- Public Home/Explore browse without login
- Test purchase in Stripe **test** mode → entitlement grants
- SEO (sitemap/robots), analytics
- A11y basics, error pages
