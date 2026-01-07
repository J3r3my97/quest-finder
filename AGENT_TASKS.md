# Agent Task Assignments

This document outlines the task assignments for building Quest-Finder, a government contract lead finding tool.

---

## Agent 1: Backend & Data Infrastructure

**Focus**: Data layer, API integrations, and business logic

### Tasks

#### Phase 1: Project Foundation ✅ COMPLETE
- [x] Initialize Next.js 16 project with TypeScript
- [x] Configure ESLint and Prettier
- [x] Set up Prisma v7 with PostgreSQL connection (using @prisma/adapter-pg)
- [x] Create environment variable structure (.env.example)

#### Phase 2: Database Schema ✅ COMPLETE
- [x] Design and implement Prisma schema:
  - `User` model with subscription tiers and NextAuth support
  - `Account`, `Session`, `VerificationToken` for NextAuth
  - `ContractLead` model with full SAM.gov field mapping
  - `SavedSearch` model with JSON filters
  - `Alert` model with frequency settings
- [x] Create initial migration (docker-compose.yml for PostgreSQL)
- [x] Seed sample contract data for development (prisma/seed.ts)

#### Phase 3: External API Integration ✅ COMPLETE
- [x] Implement SAM.gov API client in `src/services/sam-gov.ts`
  - Authentication via API key
  - Rate limiting (100ms delay between requests)
  - Error handling with custom SamGovApiError class
- [x] Create contract data normalization layer
- [ ] Implement caching strategy for API responses (Redis or in-memory)

#### Phase 4: API Routes ✅ COMPLETE
- [x] `GET /api/contracts` - Search contracts with filters
- [x] `GET /api/contracts/[id]` - Get single contract details
- [x] `POST /api/saved-searches` - Create saved search
- [x] `GET /api/saved-searches` - List user's saved searches
- [x] `POST /api/alerts` - Create alert for saved search
- [ ] Implement authentication middleware (pending NextAuth setup)

#### Phase 5: Background Jobs
- [ ] Set up job queue (e.g., Inngest or BullMQ)
- [ ] Implement contract data sync job (daily refresh)
- [ ] Implement alert notification job

---

## Agent 2: Frontend & User Experience

**Focus**: UI components, pages, and user interactions

### Tasks

#### Phase 1: UI Foundation ✅ COMPLETE
- [x] Set up Tailwind CSS with custom theme (professional SaaS look)
- [x] Create base layout component with navigation
- [x] Implement responsive design breakpoints
- [x] Set up shadcn/ui component library

#### Phase 2: Authentication Flow ✅ COMPLETE
- [x] Configure NextAuth.js with email/password provider
- [x] Create sign-up page (`/signup`)
- [x] Create login page (`/login`)
- [x] Implement protected route wrapper
- [x] Create user profile page (`/profile`)

#### Phase 3: Core Pages ✅ COMPLETE
- [x] **Dashboard** (`/dashboard`)
  - Summary stats (total searches, saved contracts, active alerts)
  - Recent contract matches
  - Quick search widget
- [x] **Search Page** (`/search`)
  - Search form with filters:
    - Keyword search
    - NAICS code selector
    - Agency dropdown
    - Set-aside type filter
    - Date range picker
    - Contract value range
  - Results list with pagination
  - Sort options (date, value, deadline)
- [x] **Contract Detail Page** (`/contracts/[id]`)
  - Full contract information display
  - Save to favorites action
  - Link to original source
- [x] **Saved Searches Page** (`/saved-searches`)
  - List of saved searches
  - Enable/disable alerts
  - Edit/delete functionality

#### Phase 4: Interactive Components ✅ COMPLETE
- [x] Contract card component with hover states
- [x] Filter sidebar with collapsible sections
- [ ] NAICS code autocomplete search
- [x] Toast notifications for actions
- [x] Loading skeletons for data fetching states

#### Phase 5: Subscription & Payments
- [ ] Integrate Stripe checkout
- [ ] Create pricing page (`/pricing`)
- [ ] Implement subscription management in profile
- [ ] Add feature gating based on subscription tier

---

## Coordination Notes

### Shared Dependencies
Both agents should agree on:
- TypeScript interfaces in `src/types/` for Contract, User, Search, Alert
- API response formats
- Authentication context structure

### Integration Points
- Agent 2 will consume APIs built by Agent 1
- Agent 1 should provide mock data endpoints early for Agent 2 to develop against
- Weekly sync to align on data shapes and API contracts

### Priority Order
1. Agent 1 starts with project setup and database schema
2. Agent 2 starts with UI foundation and authentication
3. Both proceed in parallel after Phase 1
4. Integration testing after Phase 3 completion

---

## Success Criteria

MVP is complete when:
- Users can sign up and log in
- Users can search government contracts with filters
- Users can save searches and set up alerts
- Basic subscription tiers are functional
- Application is deployable to Vercel
