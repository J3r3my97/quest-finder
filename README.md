# BidScout - AI-Powered Government Contract Discovery for Small Businesses

## Vision

BidScout helps small service businesses (2-50 employees) find and win local government contracts they're actually qualified for. We eliminate the confusion around compliance and certifications, surfacing only the opportunities each business can realistically pursue.

## The Problem

Small businesses leave money on the table because:
1. **They miss contracts** - Opportunities are scattered across dozens of portals
2. **Compliance feels overwhelming** - COI, W-9, bonding, certifications... where to start?
3. **They don't know which certs apply** - MBE? WBE? DBE? SDVOBE?
4. **No staff for admin** - A 10-person company can't dedicate someone to bid research
5. **Fear of failure** - They avoid bidding because the process seems risky

## The Solution

An AI-powered platform that:
- **Aggregates** opportunities from state, city, school, utility, and hospital sources
- **Matches** contracts to business profiles based on services, location, size, and certifications
- **Explains** requirements in plain English via RAG-powered Q&A
- **Tracks** compliance documents and deadlines
- **Guides** users through certification eligibility

## Target Customer

> Owner of a 2-50 person service business who could win contracts but avoids them because compliance feels confusing, risky, or time-consuming.

**Examples:**
- IT services / software consulting firms
- Janitorial and facilities management
- HVAC, electrical, plumbing contractors
- Marketing and creative agencies
- Staffing and HR services
- Landscaping and grounds maintenance

## Geographic Focus (MVP)

**Massachusetts** - Starting with:
- State contracts (COMMBUYS)
- Major cities (Boston, Cambridge, Worcester, Springfield)
- School districts
- Utilities (MBTA, MWRA, BWSC)
- Universities (UMass system)

## Contract Types (MVP Focus)

Local/quasi-governmental contracts that are:
- More accessible than federal
- Shorter procurement cycles
- Lower compliance barriers
- Repeatable once won

**Common requirements:**
- Certificate of Insurance (COI)
- W-9
- Business license
- Bonding (for some trades)
- Minority/small business certifications (sometimes optional, sometimes required)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        DATA INGESTION                           │
├─────────────────────────────────────────────────────────────────┤
│  Scrapers          │  Email Parser     │  RSS/Feed Parser       │
│  - COMMBUYS        │  - Bid alerts     │  - Where available     │
│  - Municipal sites │  - Notifications  │                        │
│  - Platform APIs   │                   │                        │
└────────┬───────────┴────────┬──────────┴───────────┬────────────┘
         │                    │                      │
         ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PROCESSING PIPELINE                         │
├─────────────────────────────────────────────────────────────────┤
│  Change Detector   │  Contract Parser  │  Document Processor    │
│  - Hash comparison │  - Field extract  │  - PDF text extraction │
│  - Delta events    │  - Normalize data │  - Chunking            │
│  - New bid alerts  │  - Categorize     │  - Embedding           │
└────────┬───────────┴────────┬──────────┴───────────┬────────────┘
         │                    │                      │
         ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                        DATA STORAGE                             │
├─────────────────────────────────────────────────────────────────┤
│  PostgreSQL                          │  Vector Store            │
│  - Contracts                         │  - Document embeddings   │
│  - Businesses                        │  - Semantic search       │
│  - Documents                         │  - RAG retrieval         │
│  - Sources                           │                          │
│  - Certifications                    │  Object Storage (S3)     │
│                                      │  - PDF attachments       │
│                                      │  - User documents        │
└────────┬─────────────────────────────┴───────────┬──────────────┘
         │                                         │
         ▼                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Matching Engine   │  RAG Q&A System   │  Alert Service         │
│  - Profile match   │  - Claude API     │  - Email (SendGrid)    │
│  - Scoring/ranking │  - Context build  │  - SMS (Twilio)        │
│  - Recommendations │  - Answer gen     │  - Digest scheduling   │
└────────┬───────────┴────────┬──────────┴───────────┬────────────┘
         │                    │                      │
         ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│  REST API (FastAPI)                                             │
│  - /contracts      - /businesses      - /documents              │
│  - /matches        - /chat            - /alerts                 │
│  - /certifications - /compliance      - /sources                │
└────────┬────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
├─────────────────────────────────────────────────────────────────┤
│  Next.js Application                                            │
│  - Dashboard (matched opportunities)                            │
│  - Contract detail view                                         │
│  - Chat interface (RAG Q&A)                                     │
│  - Business profile setup                                       │
│  - Document vault                                               │
│  - Certification wizard                                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
bidscout/
├── README.md                 # This file
├── docs/
│   ├── ARCHITECTURE.md       # Detailed architecture
│   ├── DATA_SOURCES.md       # MA procurement sources
│   ├── DATABASE_SCHEMA.md    # PostgreSQL schema
│   ├── SCRAPING.md           # Scraper specifications
│   ├── MATCHING.md           # Matching algorithm
│   ├── RAG_SYSTEM.md         # RAG implementation
│   ├── API_SPEC.md           # API endpoints
│   ├── FRONTEND.md           # Frontend specs
│   ├── COMPLIANCE.md         # Compliance tracking
│   ├── CERTIFICATIONS.md     # Certification guide
│   └── DEPLOYMENT.md         # Deployment guide
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── api/
│   │   ├── services/
│   │   └── db/
│   ├── scrapers/
│   ├── processors/
│   ├── workers/
│   └── tests/
├── frontend/
│   └── (Next.js app)
├── infrastructure/
│   ├── docker-compose.yml
│   └── terraform/
└── scripts/
    └── seed_data/
```

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Backend** | Python + FastAPI | Async, great for scraping, ML ecosystem |
| **Database** | PostgreSQL + pgvector | Relational + vector search in one |
| **Task Queue** | Celery + Redis | Scheduled scraping, background jobs |
| **Scraping** | Playwright + BeautifulSoup | JS rendering + HTML parsing |
| **PDF Parsing** | pdfplumber / PyMuPDF | Extract text from bid documents |
| **LLM** | Claude API (Anthropic) | RAG Q&A, document understanding |
| **Embeddings** | Anthropic/OpenAI | Document vectorization |
| **Email** | SendGrid | Transactional + alerts |
| **SMS** | Twilio | Deadline reminders |
| **Frontend** | Next.js + Tailwind | Modern React, fast development |
| **Auth** | Clerk or Supabase Auth | Easy auth with good UX |
| **Storage** | S3 / Cloudflare R2 | PDF and document storage |
| **Hosting** | Railway / Render / AWS | Start simple, scale later |

---

## MVP Features

### Phase 1: Core (Weeks 1-6)
- [ ] Data ingestion from 5 MA sources
- [ ] Contract normalization and storage
- [ ] Business profile creation
- [ ] Basic keyword + location matching
- [ ] Email alerts for new matches
- [ ] Simple dashboard showing matched opportunities

### Phase 2: Intelligence (Weeks 6-10)
- [ ] RAG-powered Q&A about contracts
- [ ] Certification eligibility assessment
- [ ] Requirements breakdown per opportunity
- [ ] Document vault (upload W-9, COI, etc.)
- [ ] Compliance checklist per contract

### Phase 3: Polish (Weeks 10-12)
- [ ] Improved matching algorithm
- [ ] SMS deadline reminders
- [ ] Saved searches
- [ ] Historical award data (who won what)
- [ ] Basic analytics

### Deferred to V2
- Auto-populate applications
- Direct submission
- Federal contracts (SAM.gov)
- Multi-state expansion
- Win probability scoring
- Subcontracting marketplace

---

## Getting Started

See individual documentation files for detailed specifications:

1. **[DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)** - Start here for data models
2. **[SCRAPING.md](docs/SCRAPING.md)** - Data source scrapers
3. **[MATCHING.md](docs/MATCHING.md)** - Matching algorithm
4. **[RAG_SYSTEM.md](docs/RAG_SYSTEM.md)** - AI Q&A implementation
5. **[API_SPEC.md](docs/API_SPEC.md)** - Backend API design
6. **[FRONTEND.md](docs/FRONTEND.md)** - UI specifications

---

## Key Differentiators

1. **Contracts you can actually win** - Not just aggregation, but intelligent matching based on your real capabilities and certifications

2. **Plain English compliance** - RAG-powered explanations of what's required, no legal jargon

3. **Small business focus** - Built for 2-50 person companies, not enterprise contractors

4. **Local/state focus** - Where small businesses have the best odds, not federal

5. **Certification guidance** - Know which certifications apply before you apply

---

## Success Metrics

- **Activation**: User creates profile and receives first matched opportunity
- **Engagement**: User asks a question via chat or views contract details
- **Value**: User downloads a bid document or adds to saved opportunities
- **Conversion**: User submits a bid (tracked via self-report initially)
- **Retention**: User returns within 7 days

---

## Contact

This project is being built by [Your Name] - a small business owner who experienced these pain points firsthand.
