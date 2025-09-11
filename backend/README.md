# STEB.IO Next.js Marketplace Skeleton

This repository provides a starting point for building the STEB.IO marketplace on a modern Next.js framework. It includes a minimal implementation of public browsing pages, API routes, a Prisma schema, seed data, and utility libraries (database, environment variables, Stripe). The goal is to match the user experience of contemporary digital marketplaces while keeping the stack simple and extensible.

## Highlights

- **Next.js 14+ App Router** with server components and API routes.
- **Prisma** for data modeling and migrations.
- **Stripe** integration for checkout and webhooks.
- **Seed script** to populate 12 creators and 24 products.
- **Environment loader** using `zod` to validate required variables.
- **Dark-themed pages** for home, explore, and product detail.
- **Minimal API endpoints** for listing products, fetching single products, creating a checkout session, and handling Stripe webhooks.
- **Skeleton packages** for a UI design system and shared core utilities.

## Getting Started

1. Copy `.env.example` to `.env` and fill in the required secrets.
2. Install dependencies (requires Node.js 20.x and `pnpm`):

   ```bash
   pnpm install
   ```

3. Push the Prisma schema to your database and seed sample data:

   ```bash
   pnpm --filter @stebio/web prisma db push
   pnpm --filter @stebio/web tsx prisma/seed.ts
   ```

4. Build and start the app locally:

   ```bash
   pnpm --filter @stebio/web build
   pnpm --filter @stebio/web start
   ```

5. Open http://localhost:3000 to explore the basic storefront.

Refer to the prompt instructions for deployment details on WordPress.com or your own backend service.