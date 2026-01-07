# Deployment Guide

## Overview

This guide covers deploying BidScout to production. We recommend starting with a simple setup (Railway/Render) and scaling as needed.

---

## Architecture Options

### Option 1: Simple (Recommended for MVP)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Railway / Render                         │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Next.js App    │  FastAPI        │  Background Workers         │
│  (Frontend)     │  (Backend)      │  (Celery)                   │
└────────┬────────┴────────┬────────┴────────┬────────────────────┘
         │                 │                 │
         └─────────────────┴─────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         ┌────▼────┐              ┌─────▼─────┐
         │ Supabase│              │ Redis     │
         │ (DB)    │              │ (Queue)   │
         └─────────┘              └───────────┘
```

**Pros:** Simple, low cost, quick to deploy
**Cons:** Limited scaling, shared resources

### Option 2: Production (Future)

```
┌─────────────────────────────────────────────────────────────────┐
│                           AWS / GCP                             │
├─────────────────────────────────────────────────────────────────┤
│                       Load Balancer                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────▼────┐        ┌─────▼─────┐       ┌─────▼─────┐
    │ Vercel  │        │ ECS/Cloud │       │ ECS/Cloud │
    │ (Next)  │        │ Run (API) │       │ Run (Work)│
    └─────────┘        └───────────┘       └───────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
         ┌────▼────┐                  ┌─────▼─────┐
         │ RDS     │                  │ ElastiC.  │
         │ Postgres│                  │ Redis     │
         └─────────┘                  └───────────┘
```

---

## Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/bidscout
REDIS_URL=redis://localhost:6379

# Auth
AUTH_SECRET_KEY=your-secret-key-here
AUTH_ALGORITHM=HS256
AUTH_ACCESS_TOKEN_EXPIRE_MINUTES=1440

# External Services
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...  # For embeddings
SENDGRID_API_KEY=SG....
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Storage
S3_BUCKET=bidscout-documents
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# App
APP_ENV=production
LOG_LEVEL=INFO
CORS_ORIGINS=https://bidscout.com,https://www.bidscout.com
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=https://api.bidscout.com/v1
NEXT_PUBLIC_APP_URL=https://bidscout.com

# Auth (Clerk example)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
```

---

## Docker Setup

### Backend Dockerfile

```dockerfile
# backend/Dockerfile

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright browsers for scraping
RUN pip install playwright && playwright install chromium --with-deps

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Worker Dockerfile

```dockerfile
# backend/Dockerfile.worker

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install playwright && playwright install chromium --with-deps

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["celery", "-A", "workers.celery_app", "worker", "--loglevel=info"]
```

### Docker Compose (Development)

```yaml
# docker-compose.yml

version: '3.8'

services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: bidscout
      POSTGRES_PASSWORD: bidscout
      POSTGRES_DB: bidscout
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  api:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://bidscout:bidscout@db:5432/bidscout
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./backend:/app

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile.worker
    environment:
      DATABASE_URL: postgresql://bidscout:bidscout@db:5432/bidscout
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - ./backend:/app

  beat:
    build:
      context: ./backend
      dockerfile: Dockerfile.worker
    command: celery -A workers.celery_app beat --loglevel=info
    environment:
      DATABASE_URL: postgresql://bidscout:bidscout@db:5432/bidscout
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000/v1
    depends_on:
      - api

volumes:
  postgres_data:
```

---

## Railway Deployment

### 1. Create Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init
```

### 2. Add Services

In Railway dashboard:
1. Add PostgreSQL plugin
2. Add Redis plugin
3. Create service from GitHub repo (backend)
4. Create service from GitHub repo (frontend)

### 3. Configure Environment Variables

Set all environment variables in Railway dashboard for each service.

### 4. Configure Build

**Backend railway.json:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "backend/Dockerfile"
  },
  "deploy": {
    "startCommand": "uvicorn app.main:app --host 0.0.0.0 --port $PORT",
    "healthcheckPath": "/health"
  }
}
```

### 5. Set Up Custom Domain

1. Go to Settings > Domains
2. Add custom domain
3. Update DNS records

---

## Database Migrations

### Using Alembic

```bash
# Initialize Alembic (first time)
cd backend
alembic init migrations

# Create migration
alembic revision --autogenerate -m "Add new table"

# Run migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Migration in Production

```bash
# In deployment script or CI/CD
python -m alembic upgrade head
```

---

## CI/CD Pipeline

### GitHub Actions

```yaml
# .github/workflows/deploy.yml

name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-asyncio
      
      - name: Run tests
        run: |
          cd backend
          pytest

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@v1
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: backend

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend
```

---

## Monitoring

### Application Monitoring

**Sentry (Error Tracking):**

```python
# backend/app/main.py

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    integrations=[FastApiIntegration()],
    traces_sample_rate=0.1,
)
```

### Infrastructure Monitoring

- **Railway:** Built-in metrics dashboard
- **AWS:** CloudWatch
- **Self-hosted:** Grafana + Prometheus

### Logging

```python
# backend/app/logging_config.py

import logging
import sys
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
        }
        if record.exc_info:
            log_record["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_record)

def setup_logging():
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        handlers=[handler]
    )
```

---

## Backup Strategy

### Database Backups

**Automated (Railway/Supabase):**
- Automatic daily backups
- Point-in-time recovery

**Manual:**
```bash
# Backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20260106.sql
```

### Document Storage Backups

S3 versioning enabled for document storage.

---

## Scaling Considerations

### Horizontal Scaling

1. **API:** Add more instances behind load balancer
2. **Workers:** Add more Celery workers
3. **Database:** Read replicas for queries

### Caching

```python
# Add Redis caching for frequently accessed data

from functools import lru_cache
import redis

redis_client = redis.from_url(os.getenv("REDIS_URL"))

async def get_contract_cached(contract_id: str):
    cache_key = f"contract:{contract_id}"
    cached = redis_client.get(cache_key)
    
    if cached:
        return json.loads(cached)
    
    contract = await db.contracts.find_one({"_id": contract_id})
    redis_client.setex(cache_key, 3600, json.dumps(contract))
    
    return contract
```

### Rate Limiting Scaling

Move rate limiting to Redis for distributed enforcement across multiple API instances.

---

## Security Checklist

- [ ] HTTPS everywhere
- [ ] Environment variables for secrets
- [ ] Database connection encryption
- [ ] API rate limiting
- [ ] Input validation
- [ ] SQL injection prevention (parameterized queries)
- [ ] CORS configuration
- [ ] Authentication on all protected routes
- [ ] Regular dependency updates
- [ ] Security headers (Helmet/similar)
- [ ] File upload validation
- [ ] Audit logging for sensitive operations

---

## Launch Checklist

1. [ ] All environment variables set
2. [ ] Database migrations run
3. [ ] SSL certificates configured
4. [ ] DNS records updated
5. [ ] Error tracking (Sentry) configured
6. [ ] Logging configured
7. [ ] Backup system verified
8. [ ] Rate limiting tested
9. [ ] Auth flow tested end-to-end
10. [ ] Scrapers running on schedule
11. [ ] Email notifications working
12. [ ] Monitoring dashboards set up
