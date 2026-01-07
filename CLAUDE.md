# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Quest-Finder** is a micro SaaS application for discovering and tracking government contract opportunities. The tool helps users find relevant government contract leads from sources like SAM.gov, GovWin, and other federal/state procurement platforms.

## Technology Stack (Planned)

- **Frontend**: Next.js 14+ with TypeScript, Tailwind CSS
- **Backend**: Next.js API routes / Server Actions
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: NextAuth.js
- **Payments**: Stripe integration for SaaS subscriptions
- **Deployment**: Vercel

## Project Structure (Target)

```
quest-finder/
├── src/
│   ├── app/              # Next.js App Router pages and layouts
│   ├── components/       # Reusable UI components
│   ├── lib/              # Shared utilities and configurations
│   ├── services/         # External API integrations (SAM.gov, etc.)
│   └── types/            # TypeScript type definitions
├── prisma/               # Database schema and migrations
└── public/               # Static assets
```

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Run tests
npm test

# Run single test file
npm test -- path/to/test.ts

# Database migrations
npx prisma migrate dev
npx prisma generate
```

## Core Domain Concepts

- **Contract Lead**: A government contract opportunity with metadata (agency, value, deadline, NAICS codes)
- **Search Filters**: NAICS codes, set-aside types, agency preferences, geographic location
- **Subscription Tier**: Free tier with limited searches, paid tiers with alerts and saved searches
- **Alert**: Automated notification when new contracts match user criteria

## External API Integrations

- **SAM.gov API**: Primary source for federal contract opportunities
- **USASpending.gov**: Historical contract data and spending analysis

## Architecture Notes

- Use Server Components by default, Client Components only when necessary for interactivity
- Implement rate limiting for external API calls
- Cache contract data to reduce API calls and improve response times
- Use background jobs for processing alerts and bulk data fetches
