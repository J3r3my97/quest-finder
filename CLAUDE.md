# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Quest-Finder** is a micro SaaS application for discovering and tracking government contract opportunities. The tool helps users find relevant government contract leads from sources like SAM.gov.

## Technology Stack

- **Framework**: Next.js 16 with App Router, TypeScript, Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Database**: PostgreSQL with Prisma ORM v7 (uses @prisma/adapter-pg)
- **Authentication**: NextAuth.js with credentials provider
- **Payments**: Stripe (to be implemented)

## Project Structure

```
src/
├── app/
│   ├── (auth)/              # Auth pages (login, signup)
│   ├── (protected)/         # Protected routes (dashboard, search, profile, saved-searches)
│   ├── api/
│   │   ├── auth/            # NextAuth endpoints
│   │   ├── contracts/       # Contract search & detail endpoints
│   │   ├── saved-searches/  # User saved search endpoints
│   │   └── alerts/          # Alert configuration endpoints
│   └── contracts/[id]/      # Contract detail page
├── components/
│   ├── layout/              # Navbar, Footer
│   ├── providers/           # Session provider
│   └── ui/                  # shadcn/ui components
├── generated/prisma/        # Prisma generated client (gitignored)
├── lib/
│   ├── auth.ts              # NextAuth configuration
│   ├── prisma.ts            # Prisma client singleton
│   └── utils.ts             # Utility functions (cn)
├── services/sam-gov.ts      # SAM.gov API client with rate limiting
└── types/index.ts           # Shared TypeScript interfaces
prisma/
├── schema.prisma            # Database models
└── migrations/              # Database migrations
```

## Development Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # Run ESLint
npm run lint:fix     # Fix ESLint issues
npm run format       # Format with Prettier
npx prisma generate  # Regenerate Prisma client
npx prisma migrate dev --name <migration_name>  # Create migration
```

## Database Models

- **User**: Authentication, subscription tier (FREE/BASIC/PRO/ENTERPRISE)
- **ContractLead**: Government contract with agency, NAICS codes, set-aside type, deadlines
- **SavedSearch**: User's saved filter configurations (stored as JSON)
- **Alert**: Notification settings for saved searches (REALTIME/DAILY/WEEKLY)

## API Endpoints

- `GET /api/contracts` - Search contracts with filters (keyword, naicsCodes, agency, setAsideType, etc.)
- `GET /api/contracts/[id]` - Get contract details
- `GET/POST /api/saved-searches` - Manage saved searches (requires auth)
- `GET/POST /api/alerts` - Manage alerts (requires auth)
- `POST /api/auth/register` - User registration

## SAM.gov Integration

The SAM.gov client (`src/services/sam-gov.ts`) includes:
- Rate limiting (100ms between requests to respect 10 req/sec limit)
- Data normalization from SAM.gov format to our schema
- Error handling with custom `SamGovApiError` class

Required env var: `SAM_GOV_API_KEY`

## Architecture Notes

- Prisma v7 requires adapter pattern - uses `@prisma/adapter-pg` with `pg` Pool
- Generated Prisma files are in `src/generated/prisma/` and excluded from ESLint
- API routes use lazy Prisma initialization via Proxy to avoid build-time DB connections
- Protected routes use NextAuth middleware for authentication
- shadcn/ui components are in `src/components/ui/`
