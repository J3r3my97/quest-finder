# Database Schema

## Overview

BidScout uses PostgreSQL with the pgvector extension for combined relational and vector storage. This document defines all tables, relationships, and indexes.

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     sources     │       │    contracts    │       │   attachments   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │──┐    │ id              │──┐    │ id              │
│ name            │  │    │ source_id (FK)  │  │    │ contract_id(FK) │
│ type            │  └───▶│ external_id     │  └───▶│ filename        │
│ base_url        │       │ title           │       │ url             │
│ scrape_config   │       │ description     │       │ s3_key          │
│ enabled         │       │ posted_date     │       │ content_text    │
│ last_scraped    │       │ deadline        │       │ created_at      │
└─────────────────┘       │ entity_name     │       └─────────────────┘
                          │ entity_type     │
                          │ location        │
                          │ estimated_value │       ┌─────────────────┐
                          │ categories      │       │ contract_reqs   │
                          │ naics_codes     │       ├─────────────────┤
                          │ requirements    │──────▶│ id              │
                          │ set_asides      │       │ contract_id(FK) │
                          │ source_url      │       │ requirement_type│
                          │ status          │       │ description     │
                          │ raw_html        │       │ is_mandatory    │
                          │ content_hash    │       └─────────────────┘
                          │ created_at      │
                          │ updated_at      │
                          └─────────────────┘
                                  │
                                  │ matching
                                  ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   businesses    │       │     matches     │       │  business_docs  │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id              │──┐    │ id              │       │ id              │
│ user_id (FK)    │  │    │ business_id(FK) │◀──────│ business_id(FK) │
│ name            │  └───▶│ contract_id(FK) │       │ doc_type        │
│ description     │       │ score           │       │ filename        │
│ location        │       │ match_reasons   │       │ s3_key          │
│ service_types   │       │ status          │       │ expiration_date │
│ naics_codes     │       │ created_at      │       │ verified        │
│ employee_count  │       │ viewed_at       │       │ created_at      │
│ annual_revenue  │       │ saved           │       │ updated_at      │
│ certifications  │       └─────────────────┘       └─────────────────┘
│ target_contract │
│ preferences     │
│ created_at      │       ┌─────────────────┐
│ updated_at      │       │    cert_types   │
└─────────────────┘       ├─────────────────┤
        │                 │ id              │
        │                 │ code            │
        └────────────────▶│ name            │
                          │ issuing_body    │
                          │ description     │
┌─────────────────┐       │ requirements    │
│      users      │       │ ma_specific     │
├─────────────────┤       └─────────────────┘
│ id              │
│ email           │
│ name            │       ┌─────────────────┐
│ auth_provider_id│       │   embeddings    │
│ created_at      │       ├─────────────────┤
│ last_login      │       │ id              │
└─────────────────┘       │ source_type     │
                          │ source_id       │
                          │ chunk_index     │
                          │ content         │
                          │ embedding (vec) │
                          │ metadata        │
                          └─────────────────┘
```

---

## Table Definitions

### sources

Tracks procurement data sources (websites, portals) we scrape.

```sql
CREATE TABLE sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'state', 'city', 'school', 'utility', 'university', 'hospital'
    entity_name VARCHAR(255), -- 'City of Boston', 'MBTA', etc.
    base_url VARCHAR(500) NOT NULL,
    scrape_config JSONB NOT NULL DEFAULT '{}',
    /*
        scrape_config example:
        {
            "scraper_type": "playwright" | "requests",
            "schedule": "0 */4 * * *",
            "selectors": {...},
            "auth_required": false,
            "rate_limit_ms": 1000
        }
    */
    enabled BOOLEAN DEFAULT true,
    last_scraped_at TIMESTAMP WITH TIME ZONE,
    last_success_at TIMESTAMP WITH TIME ZONE,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sources_enabled ON sources(enabled);
CREATE INDEX idx_sources_type ON sources(type);
```

### contracts

Core table storing normalized contract/bid opportunities.

```sql
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES sources(id),
    external_id VARCHAR(255) NOT NULL, -- ID from the source system
    
    -- Basic info
    title VARCHAR(500) NOT NULL,
    description TEXT,
    
    -- Dates
    posted_date DATE,
    deadline TIMESTAMP WITH TIME ZONE,
    pre_bid_date TIMESTAMP WITH TIME ZONE, -- Pre-bid meeting/conference
    questions_deadline TIMESTAMP WITH TIME ZONE,
    
    -- Entity info
    entity_name VARCHAR(255), -- 'City of Boston', 'Worcester Public Schools'
    entity_type VARCHAR(50), -- 'city', 'school_district', 'utility', 'state_agency'
    department VARCHAR(255), -- Specific department if applicable
    contact_name VARCHAR(255),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(50),
    
    -- Location
    location_city VARCHAR(100),
    location_county VARCHAR(100),
    location_state VARCHAR(2) DEFAULT 'MA',
    location_zip VARCHAR(10),
    service_area JSONB, -- For contracts covering multiple areas
    
    -- Classification
    categories VARCHAR(100)[] DEFAULT '{}', -- ['IT Services', 'Software Development']
    naics_codes VARCHAR(10)[] DEFAULT '{}', -- ['541511', '541512']
    unspsc_codes VARCHAR(20)[] DEFAULT '{}',
    contract_type VARCHAR(50), -- 'IFB', 'RFP', 'RFQ', 'sole_source'
    
    -- Value
    estimated_value_min DECIMAL(15,2),
    estimated_value_max DECIMAL(15,2),
    contract_duration VARCHAR(100), -- '1 year with 2 renewal options'
    
    -- Requirements (denormalized for quick filtering)
    requires_bonding BOOLEAN DEFAULT false,
    bond_amount DECIMAL(15,2),
    requires_insurance BOOLEAN DEFAULT true,
    insurance_minimum DECIMAL(15,2),
    requires_certification BOOLEAN DEFAULT false,
    required_certifications VARCHAR(50)[] DEFAULT '{}', -- ['MBE', 'WBE']
    
    -- Set-asides
    set_asides VARCHAR(50)[] DEFAULT '{}', -- ['small_business', 'mbe', 'wbe']
    is_set_aside BOOLEAN DEFAULT false,
    
    -- Source tracking
    source_url VARCHAR(1000) NOT NULL,
    source_bid_number VARCHAR(100),
    
    -- Status
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'closed', 'awarded', 'cancelled'
    awarded_to VARCHAR(255),
    award_amount DECIMAL(15,2),
    award_date DATE,
    
    -- Processing
    raw_html TEXT,
    content_hash VARCHAR(64), -- For change detection
    processed BOOLEAN DEFAULT false,
    embedding_generated BOOLEAN DEFAULT false,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(source_id, external_id)
);

-- Indexes for common queries
CREATE INDEX idx_contracts_source ON contracts(source_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_deadline ON contracts(deadline) WHERE status = 'open';
CREATE INDEX idx_contracts_posted ON contracts(posted_date DESC);
CREATE INDEX idx_contracts_location ON contracts(location_city, location_state);
CREATE INDEX idx_contracts_entity_type ON contracts(entity_type);
CREATE INDEX idx_contracts_categories ON contracts USING GIN(categories);
CREATE INDEX idx_contracts_naics ON contracts USING GIN(naics_codes);
CREATE INDEX idx_contracts_set_asides ON contracts USING GIN(set_asides);
CREATE INDEX idx_contracts_hash ON contracts(content_hash);

-- Full text search
CREATE INDEX idx_contracts_fts ON contracts 
    USING GIN(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));
```

### contract_requirements

Detailed requirements extracted from contracts.

```sql
CREATE TABLE contract_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    requirement_type VARCHAR(50) NOT NULL,
    /*
        Types:
        - 'insurance_coi' - Certificate of Insurance
        - 'insurance_gl' - General Liability
        - 'insurance_wc' - Workers Comp
        - 'insurance_auto' - Auto
        - 'insurance_professional' - Professional Liability/E&O
        - 'bonding_bid' - Bid Bond
        - 'bonding_performance' - Performance Bond
        - 'bonding_payment' - Payment Bond
        - 'certification' - Required certification
        - 'registration' - Vendor registration
        - 'document' - Required document (W-9, etc.)
        - 'experience' - Past performance/experience
        - 'financial' - Financial statements, credit
        - 'personnel' - Key personnel, resumes
        - 'equipment' - Required equipment/facilities
        - 'license' - Professional license
        - 'other'
    */
    
    description TEXT NOT NULL,
    amount DECIMAL(15,2), -- For insurance/bond amounts
    is_mandatory BOOLEAN DEFAULT true,
    notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contract_reqs_contract ON contract_requirements(contract_id);
CREATE INDEX idx_contract_reqs_type ON contract_requirements(requirement_type);
```

### attachments

PDF and document attachments for contracts.

```sql
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    filename VARCHAR(500) NOT NULL,
    original_url VARCHAR(1000),
    s3_key VARCHAR(500), -- Storage location
    file_size_bytes INTEGER,
    mime_type VARCHAR(100),
    
    -- Extracted content
    content_text TEXT, -- Extracted text from PDF
    page_count INTEGER,
    extraction_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    extraction_error TEXT,
    
    -- Classification
    attachment_type VARCHAR(50), -- 'bid_document', 'specifications', 'addendum', 'form', 'other'
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attachments_contract ON attachments(contract_id);
CREATE INDEX idx_attachments_extraction ON attachments(extraction_status);
```

### users

User accounts (minimal - auth handled by external provider).

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    
    -- External auth
    auth_provider VARCHAR(50), -- 'clerk', 'supabase', etc.
    auth_provider_id VARCHAR(255),
    
    -- Preferences
    email_notifications BOOLEAN DEFAULT true,
    sms_notifications BOOLEAN DEFAULT false,
    phone VARCHAR(20),
    notification_frequency VARCHAR(20) DEFAULT 'daily', -- 'realtime', 'daily', 'weekly'
    
    -- Status
    email_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth ON users(auth_provider, auth_provider_id);
```

### businesses

Business profiles for matching.

```sql
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Basic info
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    dba_name VARCHAR(255),
    description TEXT,
    website VARCHAR(500),
    
    -- Location
    address_street VARCHAR(255),
    address_city VARCHAR(100),
    address_state VARCHAR(2) DEFAULT 'MA',
    address_zip VARCHAR(10),
    service_radius_miles INTEGER DEFAULT 50,
    service_areas JSONB, -- Specific cities/counties they serve
    
    -- Classification
    service_types VARCHAR(100)[] DEFAULT '{}', -- ['IT Services', 'Software Development', 'Consulting']
    service_keywords TEXT[], -- Additional keywords for matching
    naics_codes VARCHAR(10)[] DEFAULT '{}',
    
    -- Size
    employee_count_min INTEGER,
    employee_count_max INTEGER,
    annual_revenue_min DECIMAL(15,2),
    annual_revenue_max DECIMAL(15,2),
    years_in_business INTEGER,
    
    -- Ownership (for certification matching)
    ownership_demographics JSONB,
    /*
        {
            "minority_owned": true,
            "woman_owned": true,
            "veteran_owned": false,
            "disabled_owned": false,
            "lgbtq_owned": false,
            "minority_percentage": 51,
            "woman_percentage": 51
        }
    */
    
    -- Certifications held
    certifications JSONB DEFAULT '[]',
    /*
        [
            {
                "type": "MBE",
                "issuer": "MA SDO",
                "number": "123456",
                "expiration": "2025-12-31",
                "verified": true
            }
        ]
    */
    
    -- Capabilities
    bonding_capacity DECIMAL(15,2),
    insurance_coverage JSONB,
    /*
        {
            "general_liability": 1000000,
            "professional_liability": 1000000,
            "workers_comp": true,
            "auto": true
        }
    */
    
    -- Contract preferences
    contract_size_min DECIMAL(15,2),
    contract_size_max DECIMAL(15,2),
    target_entity_types VARCHAR(50)[] DEFAULT '{}', -- ['city', 'school_district', 'state_agency']
    excluded_keywords TEXT[], -- Keywords to avoid
    
    -- Matching
    matching_enabled BOOLEAN DEFAULT true,
    last_matched_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_businesses_user ON businesses(user_id);
CREATE INDEX idx_businesses_location ON businesses(address_city, address_state);
CREATE INDEX idx_businesses_services ON businesses USING GIN(service_types);
CREATE INDEX idx_businesses_naics ON businesses USING GIN(naics_codes);
CREATE INDEX idx_businesses_matching ON businesses(matching_enabled) WHERE matching_enabled = true;
```

### business_documents

Compliance documents uploaded by businesses.

```sql
CREATE TABLE business_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    doc_type VARCHAR(50) NOT NULL,
    /*
        Types:
        - 'w9'
        - 'coi' - Certificate of Insurance
        - 'business_license'
        - 'certification_mbe'
        - 'certification_wbe'
        - 'certification_vbe'
        - 'certification_dbe'
        - 'certification_sdvobe'
        - 'bond_letter'
        - 'financial_statement'
        - 'capability_statement'
        - 'past_performance'
        - 'other'
    */
    
    filename VARCHAR(500) NOT NULL,
    s3_key VARCHAR(500) NOT NULL,
    file_size_bytes INTEGER,
    mime_type VARCHAR(100),
    
    -- Validity
    effective_date DATE,
    expiration_date DATE,
    is_current BOOLEAN DEFAULT true,
    
    -- Verification
    verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP WITH TIME ZONE,
    verification_notes TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    /*
        For COI: {"carrier": "...", "policy_number": "...", "coverage_amount": ...}
        For certs: {"cert_number": "...", "issuing_body": "..."}
    */
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_business_docs_business ON business_documents(business_id);
CREATE INDEX idx_business_docs_type ON business_documents(doc_type);
CREATE INDEX idx_business_docs_expiration ON business_documents(expiration_date) 
    WHERE expiration_date IS NOT NULL;
CREATE INDEX idx_business_docs_current ON business_documents(business_id, doc_type) 
    WHERE is_current = true;
```

### matches

Contract-to-business matches with scoring.

```sql
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
    
    -- Scoring
    score DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000
    score_breakdown JSONB,
    /*
        {
            "service_match": 0.85,
            "location_match": 1.0,
            "size_match": 0.9,
            "certification_match": 1.0,
            "experience_match": 0.7
        }
    */
    
    match_reasons TEXT[], -- Human-readable reasons
    /*
        [
            "Services align: IT Consulting, Software Development",
            "Located within service area (Boston)",
            "Contract size within target range",
            "MBE certification matches set-aside"
        ]
    */
    
    -- Flags
    missing_requirements TEXT[], -- What they'd need to qualify
    /*
        [
            "Requires Performance Bond ($50,000)",
            "Professional Liability insurance minimum $2M (you have $1M)"
        ]
    */
    
    -- User interaction
    status VARCHAR(50) DEFAULT 'new', -- 'new', 'viewed', 'saved', 'dismissed', 'applied'
    viewed_at TIMESTAMP WITH TIME ZONE,
    saved BOOLEAN DEFAULT false,
    saved_at TIMESTAMP WITH TIME ZONE,
    dismissed BOOLEAN DEFAULT false,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    dismissed_reason VARCHAR(255),
    applied BOOLEAN DEFAULT false,
    applied_at TIMESTAMP WITH TIME ZONE,
    
    -- Notes
    user_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(business_id, contract_id)
);

CREATE INDEX idx_matches_business ON matches(business_id);
CREATE INDEX idx_matches_contract ON matches(contract_id);
CREATE INDEX idx_matches_score ON matches(business_id, score DESC);
CREATE INDEX idx_matches_status ON matches(business_id, status);
CREATE INDEX idx_matches_saved ON matches(business_id) WHERE saved = true;
CREATE INDEX idx_matches_new ON matches(business_id, created_at DESC) WHERE status = 'new';
```

### certification_types

Reference table for certification types.

```sql
CREATE TABLE certification_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE, -- 'MBE', 'WBE', 'VBE', 'DBE', etc.
    name VARCHAR(255) NOT NULL,
    
    -- Issuing body
    issuing_body VARCHAR(255), -- 'MA Supplier Diversity Office'
    issuing_body_url VARCHAR(500),
    
    -- Details
    description TEXT,
    eligibility_summary TEXT,
    eligibility_requirements JSONB,
    /*
        {
            "ownership_percentage": 51,
            "demographic": ["minority"],
            "location": "MA",
            "size_standards": {...}
        }
    */
    
    -- Application
    application_url VARCHAR(500),
    application_fee DECIMAL(10,2),
    processing_time_days INTEGER,
    
    -- MA specific
    ma_specific BOOLEAN DEFAULT false, -- Is this MA-only or federal?
    cross_certifications VARCHAR(20)[], -- What certs does this cross-certify with?
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed with MA certifications
INSERT INTO certification_types (code, name, issuing_body, ma_specific, description) VALUES
('MBE', 'Minority Business Enterprise', 'MA Supplier Diversity Office', true, 'For businesses at least 51% owned and controlled by minority individuals'),
('WBE', 'Women Business Enterprise', 'MA Supplier Diversity Office', true, 'For businesses at least 51% owned and controlled by women'),
('VBE', 'Veteran Business Enterprise', 'MA Supplier Diversity Office', true, 'For businesses at least 51% owned and controlled by veterans'),
('PBE', 'Portuguese Business Enterprise', 'MA Supplier Diversity Office', true, 'For businesses at least 51% owned and controlled by Portuguese individuals'),
('DBE', 'Disadvantaged Business Enterprise', 'MA Unified Certification Program', false, 'Federal certification for USDOT-funded projects'),
('SDVOBE', 'Service-Disabled Veteran-Owned Business Enterprise', 'Disability:IN', false, 'For businesses owned by service-disabled veterans'),
('LGBTBE', 'LGBT Business Enterprise', 'NGLCC', false, 'For businesses owned by LGBT individuals'),
('DOBE', 'Disability-Owned Business Enterprise', 'Disability:IN', false, 'For businesses owned by individuals with disabilities'),
('SBE', 'Small Business Enterprise', 'Various', false, 'General small business designation');
```

### embeddings

Vector embeddings for RAG system.

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source reference
    source_type VARCHAR(50) NOT NULL, -- 'contract', 'attachment', 'certification_guide'
    source_id UUID NOT NULL,
    
    -- Chunk info
    chunk_index INTEGER NOT NULL,
    chunk_content TEXT NOT NULL,
    
    -- Vector
    embedding vector(1536), -- Dimension depends on embedding model
    
    -- Metadata for filtering
    metadata JSONB DEFAULT '{}',
    /*
        {
            "contract_id": "...",
            "entity_type": "city",
            "location": "Boston",
            "categories": ["IT Services"]
        }
    */
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(source_type, source_id, chunk_index)
);

-- Vector similarity index
CREATE INDEX idx_embeddings_vector ON embeddings 
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

CREATE INDEX idx_embeddings_source ON embeddings(source_type, source_id);
CREATE INDEX idx_embeddings_metadata ON embeddings USING GIN(metadata);
```

### alerts

Alert/notification tracking.

```sql
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    
    alert_type VARCHAR(50) NOT NULL,
    /*
        Types:
        - 'new_match' - New contract matched
        - 'deadline_reminder' - Upcoming deadline
        - 'document_expiring' - COI/cert expiring
        - 'contract_update' - Addendum or change
        - 'weekly_digest' - Weekly summary
    */
    
    -- Reference
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
    document_id UUID REFERENCES business_documents(id) ON DELETE SET NULL,
    
    -- Content
    subject VARCHAR(255),
    body TEXT,
    
    -- Delivery
    channel VARCHAR(20) NOT NULL, -- 'email', 'sms', 'in_app'
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'read'
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- External IDs
    email_provider_id VARCHAR(255), -- SendGrid message ID
    sms_provider_id VARCHAR(255), -- Twilio SID
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON alerts(user_id);
CREATE INDEX idx_alerts_status ON alerts(status) WHERE status = 'pending';
CREATE INDEX idx_alerts_type ON alerts(alert_type);
```

### saved_searches

User's saved search criteria.

```sql
CREATE TABLE saved_searches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    
    -- Search criteria
    criteria JSONB NOT NULL,
    /*
        {
            "keywords": ["software", "IT"],
            "entity_types": ["city", "school_district"],
            "locations": ["Boston", "Cambridge"],
            "min_value": 10000,
            "max_value": 500000,
            "certifications": ["MBE"],
            "exclude_keywords": ["construction"]
        }
    */
    
    -- Notification preferences
    notify_new_matches BOOLEAN DEFAULT true,
    notification_frequency VARCHAR(20) DEFAULT 'daily',
    
    last_run_at TIMESTAMP WITH TIME ZONE,
    last_match_count INTEGER DEFAULT 0,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_saved_searches_business ON saved_searches(business_id);
CREATE INDEX idx_saved_searches_active ON saved_searches(is_active) WHERE is_active = true;
```

### chat_sessions

Chat history for RAG Q&A.

```sql
CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
    contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
    
    -- Session metadata
    title VARCHAR(255),
    context_type VARCHAR(50), -- 'general', 'contract', 'certification', 'compliance'
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    
    role VARCHAR(20) NOT NULL, -- 'user', 'assistant'
    content TEXT NOT NULL,
    
    -- RAG context used (for debugging/improvement)
    retrieved_chunks JSONB, -- IDs and scores of chunks used
    
    -- Metadata
    tokens_used INTEGER,
    latency_ms INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_contract ON chat_sessions(contract_id);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
```

---

## Database Functions

### Update timestamp trigger

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    
-- ... apply to other tables as needed
```

### Contract search function

```sql
CREATE OR REPLACE FUNCTION search_contracts(
    search_query TEXT,
    location_filter VARCHAR(100) DEFAULT NULL,
    entity_type_filter VARCHAR(50) DEFAULT NULL,
    category_filter VARCHAR(100)[] DEFAULT NULL,
    min_value DECIMAL DEFAULT NULL,
    max_value DECIMAL DEFAULT NULL,
    status_filter VARCHAR(50) DEFAULT 'open',
    limit_count INTEGER DEFAULT 50,
    offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title VARCHAR(500),
    entity_name VARCHAR(255),
    deadline TIMESTAMP WITH TIME ZONE,
    estimated_value_max DECIMAL,
    categories VARCHAR(100)[],
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.title,
        c.entity_name,
        c.deadline,
        c.estimated_value_max,
        c.categories,
        ts_rank(
            to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.description, '')),
            plainto_tsquery('english', search_query)
        ) as rank
    FROM contracts c
    WHERE 
        (search_query IS NULL OR search_query = '' OR
         to_tsvector('english', coalesce(c.title, '') || ' ' || coalesce(c.description, ''))
         @@ plainto_tsquery('english', search_query))
        AND (location_filter IS NULL OR c.location_city = location_filter)
        AND (entity_type_filter IS NULL OR c.entity_type = entity_type_filter)
        AND (category_filter IS NULL OR c.categories && category_filter)
        AND (min_value IS NULL OR c.estimated_value_max >= min_value)
        AND (max_value IS NULL OR c.estimated_value_min <= max_value)
        AND (status_filter IS NULL OR c.status = status_filter)
    ORDER BY rank DESC, c.deadline ASC NULLS LAST
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;
```

---

## Migrations

Use a migration tool like Alembic (Python) or golang-migrate. Store migrations in `backend/migrations/`.

Example migration structure:
```
migrations/
├── versions/
│   ├── 001_initial_schema.sql
│   ├── 002_add_embeddings.sql
│   ├── 003_add_chat_tables.sql
│   └── ...
└── alembic.ini
```

---

## Seed Data

Initial seed data should include:
1. MA procurement sources (from DATA_SOURCES.md)
2. Certification types
3. Sample contracts for testing
4. NAICS code reference table (optional, can query external)

See `scripts/seed_data/` for seed scripts.
