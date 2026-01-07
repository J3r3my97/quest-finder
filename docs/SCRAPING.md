# Scraping Specifications

## Overview

This document details the scraping strategy for Massachusetts procurement data sources. We use a hybrid approach:
- **Change detection** over full scraping (event-driven, not crawler)
- **Email/RSS** where available (cleanest data)
- **Browser automation** (Playwright) for JS-heavy sites
- **HTTP requests** (requests + BeautifulSoup) for static sites

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SCRAPER ORCHESTRATOR                       │
│                     (Celery Beat Scheduler)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Playwright  │    │   Requests    │    │ Email Parser  │
│   Scrapers    │    │   Scrapers    │    │               │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ - COMMBUYS    │    │ - Boston      │    │ - COMMBUYS    │
│ - Cambridge   │    │ - Worcester   │    │ - WorcBids    │
│               │    │ - Springfield │    │               │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CHANGE DETECTOR                             │
│  - Hash comparison                                              │
│  - New item detection                                           │
│  - Update detection                                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONTRACT NORMALIZER                          │
│  - Field extraction                                             │
│  - Data normalization                                           │
│  - Category classification                                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE WRITER                            │
│  - Insert new contracts                                         │
│  - Update existing                                              │
│  - Trigger matching pipeline                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Source Configurations

### 1. COMMBUYS (Massachusetts State)

**Priority**: HIGH - This is the primary state source

**URL**: https://www.commbuys.com/bso/

**Scraper Type**: Playwright (JS-heavy application)

**Strategy**:
1. Navigate to open bids listing
2. Extract bid table data
3. For each bid, capture detail page
4. Download PDF attachments
5. Hash content for change detection

**Selectors** (may need updating):
```python
COMMBUYS_CONFIG = {
    "name": "COMMBUYS",
    "type": "state",
    "base_url": "https://www.commbuys.com/bso/",
    "scraper_type": "playwright",
    "schedule": "0 */4 * * *",  # Every 4 hours
    "auth_required": False,
    "rate_limit_ms": 2000,
    
    "navigation": {
        "open_bids_path": "/bso/external/publicBids.sdo",
        "search_params": {
            "mode": "search",
            "bidType": "Bid"
        }
    },
    
    "selectors": {
        "bid_table": "table.results-table",
        "bid_rows": "table.results-table tbody tr",
        "bid_link": "td a[href*='bidDetail']",
        "pagination_next": "a.next-page",
        
        # Detail page
        "detail_title": "h1.bid-title, .bid-header h1",
        "detail_number": ".bid-number",
        "detail_org": ".organization-name",
        "detail_posted": ".posted-date",
        "detail_deadline": ".closing-date",
        "detail_description": ".bid-description",
        "detail_attachments": ".attachments-list a",
        "detail_contact": ".contact-info"
    },
    
    "field_mapping": {
        "external_id": "bid_number",
        "title": "title",
        "entity_name": "organization",
        "posted_date": "posted_date",
        "deadline": "closing_date",
        "description": "description"
    }
}
```

**Parsing Notes**:
- Dates are in format "MM/DD/YYYY HH:MM AM/PM"
- Bid numbers follow pattern like "BD-XX-XXXX-XXX"
- Categories use UNSPSC codes

---

### 2. City of Boston

**Priority**: HIGH - Large volume, good data quality

**URL**: https://www.boston.gov/bid-listings

**Scraper Type**: Requests + BeautifulSoup (mostly static HTML)

**Strategy**:
1. Fetch main bid listings page
2. Parse HTML table/list of bids
3. Extract links to individual bid pages
4. Fetch each detail page
5. Extract structured data

**Configuration**:
```python
BOSTON_CONFIG = {
    "name": "City of Boston",
    "type": "city",
    "entity_name": "City of Boston",
    "base_url": "https://www.boston.gov",
    "scraper_type": "requests",
    "schedule": "0 */6 * * *",  # Every 6 hours
    "auth_required": False,
    "rate_limit_ms": 1000,
    
    "endpoints": {
        "listings": "/bid-listings",
        "detail_pattern": "/bid-listings/{bid_id}"
    },
    
    "selectors": {
        "bid_cards": ".bid-listing-card, article.node--type-bid",
        "bid_title": "h2 a, .field--name-title a",
        "bid_link": "h2 a",
        "bid_number": ".bid-number, .field--name-field-bid-number",
        "bid_deadline": ".deadline, .field--name-field-closing-date",
        "bid_department": ".department, .field--name-field-department",
        
        # Detail page
        "detail_description": ".field--name-body",
        "detail_attachments": ".file a",
        "detail_contact_name": ".contact-name",
        "detail_contact_email": ".contact-email"
    },
    
    "location_defaults": {
        "city": "Boston",
        "state": "MA"
    }
}
```

**Parsing Notes**:
- Uses Drupal CMS, field names follow Drupal conventions
- Bid IDs in URL pattern: `/bid-listings/ev00016920`
- Deadlines typically include time in EST

---

### 3. City of Cambridge

**Priority**: MEDIUM

**URL**: https://www2.cambridgema.gov/purchasing/listBids.cfm

**Scraper Type**: Requests + BeautifulSoup

**Strategy**:
1. Scrape each bid type separately (IFB, RFP, Construction)
2. Parse table structure
3. Follow links for details

**Configuration**:
```python
CAMBRIDGE_CONFIG = {
    "name": "City of Cambridge",
    "type": "city",
    "entity_name": "City of Cambridge",
    "base_url": "https://www2.cambridgema.gov",
    "scraper_type": "requests",
    "schedule": "0 8 * * *",  # Daily at 8 AM
    "auth_required": False,
    "rate_limit_ms": 1500,
    
    "endpoints": {
        "ifb": "/purchasing/listBids.cfm?bidType=f",
        "rfp": "/purchasing/listBids.cfm?bidType=r",
        "construction": "/purchasing/listBids.cfm?bidType=C"
    },
    
    "selectors": {
        "bid_table": "table",
        "bid_rows": "table tr:not(:first-child)",
        "columns": {
            "number": 0,
            "title": 1,
            "deadline": 2,
            "status": 3
        }
    },
    
    "location_defaults": {
        "city": "Cambridge",
        "state": "MA"
    }
}
```

---

### 4. City of Worcester

**Priority**: MEDIUM

**URL**: https://www.worcesterma.gov/finance/purchasing-bids

**Scraper Type**: Requests + BeautifulSoup

**Additional**: Subscribe to WorcBids email alerts for real-time updates

**Configuration**:
```python
WORCESTER_CONFIG = {
    "name": "City of Worcester",
    "type": "city",
    "entity_name": "City of Worcester",
    "base_url": "https://www.worcesterma.gov",
    "scraper_type": "requests",
    "schedule": "0 */8 * * *",  # Every 8 hours
    "auth_required": False,
    "rate_limit_ms": 1000,
    
    "endpoints": {
        "open_bids": "/finance/purchasing-bids/open-bids",
        "search": "/finance/purchasing-bids/search-bids"
    },
    
    "selectors": {
        "bid_list": ".bid-list, .views-row",
        "bid_title": ".bid-title a",
        "bid_number": ".bid-number",
        "bid_deadline": ".bid-deadline",
        "bid_type": ".bid-type"
    },
    
    "location_defaults": {
        "city": "Worcester",
        "state": "MA"
    },
    
    "email_subscription": {
        "service": "WorcBids",
        "signup_url": "https://www.worcesterma.gov/finance/purchasing-bids"
    }
}
```

---

### 5. City of Springfield

**Priority**: MEDIUM

**URL**: https://www.springfield-ma.gov/finance/procurement-bids/

**Scraper Type**: Requests + BeautifulSoup

**Configuration**:
```python
SPRINGFIELD_CONFIG = {
    "name": "City of Springfield",
    "type": "city",
    "entity_name": "City of Springfield",
    "base_url": "https://www.springfield-ma.gov",
    "scraper_type": "requests",
    "schedule": "0 9 * * *",  # Daily at 9 AM
    "auth_required": False,
    "rate_limit_ms": 1000,
    
    "endpoints": {
        "available": "/finance/procurement-bids/"
    },
    
    "selectors": {
        "bid_list": ".solicitation-item, article",
        "bid_title": "h3 a, .title a",
        "bid_number": ".bid-number",
        "bid_deadline": ".end-date, .deadline"
    },
    
    "location_defaults": {
        "city": "Springfield",
        "state": "MA"
    }
}
```

---

### 6. Boston Public Schools

**Priority**: MEDIUM

**URL**: Via Boston Supplier Portal (boston.gov/procurement)

**Scraper Type**: Same as Boston, filter by department

**Configuration**:
```python
BPS_CONFIG = {
    "name": "Boston Public Schools",
    "type": "school_district",
    "entity_name": "Boston Public Schools",
    "base_url": "https://www.boston.gov",
    "scraper_type": "requests",
    "schedule": "0 */6 * * *",
    "parent_source": "boston",  # Inherits from Boston config
    
    "filters": {
        "department": "Boston Public Schools"
    },
    
    "location_defaults": {
        "city": "Boston",
        "state": "MA"
    }
}
```

---

### 7. MBTA

**Priority**: MEDIUM

**URLs**:
- Main: https://www.mbta.com/business/bids-solicitations
- Materials: https://bc.mbta.com/business_center/bidding_solicitations/
- Capital: https://www.bidexpress.com/businesses/83754/home

**Scraper Type**: Mixed (main site = requests, BidExpress = may need special handling)

**Configuration**:
```python
MBTA_CONFIG = {
    "name": "MBTA",
    "type": "transit",
    "entity_name": "Massachusetts Bay Transportation Authority",
    "base_url": "https://www.mbta.com",
    "scraper_type": "requests",
    "schedule": "0 */12 * * *",  # Every 12 hours
    
    "endpoints": {
        "main": "/business/bids-solicitations",
        "materials": "https://bc.mbta.com/business_center/bidding_solicitations/materials_management/"
    },
    
    "notes": [
        "Small contracts (<$50K) are on FairMarkIT platform",
        "Large contracts (>$50K) managed internally",
        "Capital projects on BidExpress"
    ],
    
    "location_defaults": {
        "city": "Boston",
        "state": "MA",
        "service_area": "Greater Boston"
    }
}
```

---

### 8. UMass System

**Priority**: LOW (Phase 2)

**URL**: https://bids.sciquest.com/apps/Router/PublicEvent?CustomerOrg=UMass

**Scraper Type**: Playwright (Jaggaer platform is JS-heavy)

**Configuration**:
```python
UMASS_CONFIG = {
    "name": "UMass System",
    "type": "university",
    "entity_name": "University of Massachusetts",
    "base_url": "https://bids.sciquest.com",
    "scraper_type": "playwright",
    "schedule": "0 6 * * *",  # Daily at 6 AM
    
    "navigation": {
        "public_events": "/apps/Router/PublicEvent?CustomerOrg=UMass"
    },
    
    "notes": [
        "Uses Jaggaer/SciQuest platform",
        "All campuses (Amherst, Boston, Lowell, Dartmouth, Medical)",
        "~$1B annual spend"
    ],
    
    "location_defaults": {
        "state": "MA"
    }
}
```

---

## Scraper Base Classes

### Base Scraper Interface

```python
# backend/scrapers/base.py

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime
import hashlib
import logging

from app.models import Contract, Source
from app.db import get_db

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """Abstract base class for all scrapers."""
    
    def __init__(self, source: Source):
        self.source = source
        self.config = source.scrape_config
        self.rate_limit_ms = self.config.get('rate_limit_ms', 1000)
        self.results: List[Dict[str, Any]] = []
        self.errors: List[str] = []
    
    @abstractmethod
    async def fetch_listings(self) -> List[Dict[str, Any]]:
        """Fetch list of contract opportunities from source."""
        pass
    
    @abstractmethod
    async def fetch_detail(self, listing: Dict[str, Any]) -> Dict[str, Any]:
        """Fetch detailed information for a single contract."""
        pass
    
    @abstractmethod
    def parse_listing(self, raw_data: Any) -> Dict[str, Any]:
        """Parse raw listing data into normalized format."""
        pass
    
    @abstractmethod
    def parse_detail(self, raw_data: Any) -> Dict[str, Any]:
        """Parse raw detail data into normalized format."""
        pass
    
    def compute_hash(self, content: str) -> str:
        """Compute hash of content for change detection."""
        return hashlib.sha256(content.encode()).hexdigest()
    
    def has_changed(self, new_hash: str, existing_contract: Optional[Contract]) -> bool:
        """Check if content has changed since last scrape."""
        if not existing_contract:
            return True
        return existing_contract.content_hash != new_hash
    
    async def run(self) -> Dict[str, Any]:
        """Execute the scraper and return results."""
        start_time = datetime.utcnow()
        
        try:
            # Fetch listings
            listings = await self.fetch_listings()
            logger.info(f"[{self.source.name}] Found {len(listings)} listings")
            
            new_count = 0
            updated_count = 0
            unchanged_count = 0
            
            for listing in listings:
                try:
                    # Parse listing
                    parsed = self.parse_listing(listing)
                    
                    # Check for existing contract
                    existing = await self.get_existing_contract(parsed['external_id'])
                    
                    # Compute hash
                    content_hash = self.compute_hash(str(parsed))
                    
                    if not self.has_changed(content_hash, existing):
                        unchanged_count += 1
                        continue
                    
                    # Fetch detail if needed
                    if self.should_fetch_detail(parsed, existing):
                        detail = await self.fetch_detail(listing)
                        parsed = {**parsed, **self.parse_detail(detail)}
                    
                    parsed['content_hash'] = content_hash
                    
                    # Save
                    if existing:
                        await self.update_contract(existing, parsed)
                        updated_count += 1
                    else:
                        await self.create_contract(parsed)
                        new_count += 1
                    
                    # Rate limiting
                    await self.rate_limit()
                    
                except Exception as e:
                    logger.error(f"[{self.source.name}] Error processing listing: {e}")
                    self.errors.append(str(e))
            
            # Update source status
            await self.update_source_status(success=True)
            
            return {
                "source": self.source.name,
                "duration_seconds": (datetime.utcnow() - start_time).total_seconds(),
                "listings_found": len(listings),
                "new": new_count,
                "updated": updated_count,
                "unchanged": unchanged_count,
                "errors": len(self.errors)
            }
            
        except Exception as e:
            logger.error(f"[{self.source.name}] Scraper failed: {e}")
            await self.update_source_status(success=False, error=str(e))
            raise
    
    def should_fetch_detail(self, parsed: Dict, existing: Optional[Contract]) -> bool:
        """Determine if we need to fetch the detail page."""
        # Always fetch for new contracts
        if not existing:
            return True
        # Fetch if listing data changed
        return True  # Override in subclass for optimization
    
    async def get_existing_contract(self, external_id: str) -> Optional[Contract]:
        """Look up existing contract by external ID."""
        # Implementation depends on your DB setup
        pass
    
    async def create_contract(self, data: Dict[str, Any]) -> Contract:
        """Create new contract in database."""
        pass
    
    async def update_contract(self, contract: Contract, data: Dict[str, Any]) -> Contract:
        """Update existing contract in database."""
        pass
    
    async def update_source_status(self, success: bool, error: str = None):
        """Update source's last_scraped status."""
        pass
    
    async def rate_limit(self):
        """Apply rate limiting between requests."""
        import asyncio
        await asyncio.sleep(self.rate_limit_ms / 1000)
```

### Requests-Based Scraper

```python
# backend/scrapers/requests_scraper.py

import aiohttp
from bs4 import BeautifulSoup
from typing import List, Dict, Any

from .base import BaseScraper


class RequestsScraper(BaseScraper):
    """Scraper using aiohttp + BeautifulSoup for static sites."""
    
    def __init__(self, source):
        super().__init__(source)
        self.session = None
        self.headers = {
            'User-Agent': 'BidScout/1.0 (Government Contract Aggregator)'
        }
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(headers=self.headers)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def get_page(self, url: str) -> BeautifulSoup:
        """Fetch and parse a page."""
        async with self.session.get(url) as response:
            response.raise_for_status()
            html = await response.text()
            return BeautifulSoup(html, 'html.parser')
    
    async def download_file(self, url: str) -> bytes:
        """Download a file (PDF, etc.)."""
        async with self.session.get(url) as response:
            response.raise_for_status()
            return await response.read()
```

### Playwright-Based Scraper

```python
# backend/scrapers/playwright_scraper.py

from playwright.async_api import async_playwright, Page, Browser
from typing import List, Dict, Any
import asyncio

from .base import BaseScraper


class PlaywrightScraper(BaseScraper):
    """Scraper using Playwright for JS-heavy sites."""
    
    def __init__(self, source):
        super().__init__(source)
        self.browser: Browser = None
        self.page: Page = None
    
    async def __aenter__(self):
        playwright = await async_playwright().start()
        self.browser = await playwright.chromium.launch(headless=True)
        self.page = await self.browser.new_page()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.page:
            await self.page.close()
        if self.browser:
            await self.browser.close()
    
    async def navigate(self, url: str, wait_for: str = None):
        """Navigate to a URL and optionally wait for a selector."""
        await self.page.goto(url)
        if wait_for:
            await self.page.wait_for_selector(wait_for)
    
    async def get_text(self, selector: str) -> str:
        """Get text content of an element."""
        element = await self.page.query_selector(selector)
        if element:
            return await element.text_content()
        return ""
    
    async def get_all_texts(self, selector: str) -> List[str]:
        """Get text content of all matching elements."""
        elements = await self.page.query_selector_all(selector)
        return [await el.text_content() for el in elements]
    
    async def click_and_wait(self, selector: str, wait_for: str = None):
        """Click an element and wait for navigation/selector."""
        await self.page.click(selector)
        if wait_for:
            await self.page.wait_for_selector(wait_for)
```

---

## Change Detection

### Hash-Based Detection

```python
# backend/scrapers/change_detector.py

import hashlib
from typing import Dict, Any, List, Tuple
from datetime import datetime

from app.models import Contract
from app.db import get_db


class ChangeDetector:
    """Detects changes in scraped content."""
    
    @staticmethod
    def compute_content_hash(data: Dict[str, Any]) -> str:
        """Compute hash of relevant content fields."""
        # Only hash fields that matter for change detection
        relevant_fields = [
            'title',
            'description',
            'deadline',
            'status',
            'requirements'
        ]
        
        content = ""
        for field in relevant_fields:
            if field in data:
                content += str(data[field])
        
        return hashlib.sha256(content.encode()).hexdigest()
    
    @staticmethod
    def detect_changes(
        new_data: Dict[str, Any],
        existing: Contract
    ) -> Tuple[bool, List[str]]:
        """
        Compare new data with existing contract.
        Returns (has_changed, list_of_changes).
        """
        changes = []
        
        # Check each field
        field_checks = [
            ('title', 'Title'),
            ('description', 'Description'),
            ('deadline', 'Deadline'),
            ('status', 'Status'),
            ('estimated_value_max', 'Estimated Value'),
        ]
        
        for field, label in field_checks:
            new_val = new_data.get(field)
            old_val = getattr(existing, field, None)
            
            if new_val != old_val:
                changes.append(f"{label} changed")
        
        # Check for new attachments
        # ... additional checks
        
        return len(changes) > 0, changes
    
    @staticmethod
    def should_notify(changes: List[str]) -> bool:
        """Determine if changes warrant user notification."""
        important_changes = [
            'Deadline changed',
            'Status changed',
            'New addendum'
        ]
        
        return any(c in changes for c in important_changes)
```

---

## Contract Normalizer

```python
# backend/scrapers/normalizer.py

from typing import Dict, Any, List, Optional
from datetime import datetime, date
import re

from app.models import Contract


class ContractNormalizer:
    """Normalizes scraped data into standard contract format."""
    
    # Standard categories
    CATEGORY_MAPPING = {
        'it': 'IT Services',
        'information technology': 'IT Services',
        'software': 'Software Development',
        'consulting': 'Consulting',
        'janitorial': 'Janitorial Services',
        'cleaning': 'Janitorial Services',
        'hvac': 'HVAC',
        'electrical': 'Electrical',
        'plumbing': 'Plumbing',
        'construction': 'Construction',
        'landscaping': 'Landscaping',
        'security': 'Security Services',
        'staffing': 'Staffing',
        'marketing': 'Marketing',
        'legal': 'Legal Services',
        'accounting': 'Accounting',
        'audit': 'Audit Services',
    }
    
    def normalize(self, raw_data: Dict[str, Any], source_config: Dict) -> Dict[str, Any]:
        """Normalize raw scraped data to contract schema."""
        
        normalized = {
            'source_id': source_config['source_id'],
            'external_id': self.clean_string(raw_data.get('external_id', '')),
            'title': self.clean_string(raw_data.get('title', '')),
            'description': self.clean_string(raw_data.get('description', '')),
            
            # Dates
            'posted_date': self.parse_date(raw_data.get('posted_date')),
            'deadline': self.parse_datetime(raw_data.get('deadline')),
            
            # Entity
            'entity_name': raw_data.get('entity_name') or source_config.get('entity_name'),
            'entity_type': source_config.get('type'),
            
            # Location
            'location_city': raw_data.get('city') or source_config.get('location_defaults', {}).get('city'),
            'location_state': raw_data.get('state') or source_config.get('location_defaults', {}).get('state', 'MA'),
            
            # Classification
            'categories': self.extract_categories(raw_data),
            'naics_codes': self.extract_naics(raw_data),
            'contract_type': self.determine_contract_type(raw_data),
            
            # Value
            'estimated_value_min': self.parse_currency(raw_data.get('value_min')),
            'estimated_value_max': self.parse_currency(raw_data.get('value_max') or raw_data.get('value')),
            
            # Requirements
            'requires_bonding': self.check_bonding(raw_data),
            'requires_insurance': True,  # Almost always required
            'requires_certification': self.check_certification_required(raw_data),
            'required_certifications': self.extract_required_certs(raw_data),
            
            # Set-asides
            'set_asides': self.extract_set_asides(raw_data),
            'is_set_aside': len(self.extract_set_asides(raw_data)) > 0,
            
            # Source
            'source_url': raw_data.get('url', ''),
            'source_bid_number': raw_data.get('bid_number'),
            
            # Status
            'status': self.determine_status(raw_data),
            
            # Raw data
            'raw_html': raw_data.get('raw_html'),
        }
        
        return normalized
    
    def clean_string(self, s: Any) -> str:
        """Clean and normalize a string."""
        if not s:
            return ""
        s = str(s)
        # Remove extra whitespace
        s = re.sub(r'\s+', ' ', s)
        return s.strip()
    
    def parse_date(self, date_str: Any) -> Optional[date]:
        """Parse various date formats to date object."""
        if not date_str:
            return None
        if isinstance(date_str, date):
            return date_str
        
        date_formats = [
            '%m/%d/%Y',
            '%Y-%m-%d',
            '%B %d, %Y',
            '%b %d, %Y',
            '%m-%d-%Y',
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(str(date_str).strip(), fmt).date()
            except ValueError:
                continue
        
        return None
    
    def parse_datetime(self, dt_str: Any) -> Optional[datetime]:
        """Parse various datetime formats."""
        if not dt_str:
            return None
        if isinstance(dt_str, datetime):
            return dt_str
        
        datetime_formats = [
            '%m/%d/%Y %I:%M %p',
            '%m/%d/%Y %H:%M',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%dT%H:%M:%S',
            '%B %d, %Y %I:%M %p',
            '%m/%d/%Y',  # Date only, assume end of day
        ]
        
        for fmt in datetime_formats:
            try:
                return datetime.strptime(str(dt_str).strip(), fmt)
            except ValueError:
                continue
        
        return None
    
    def parse_currency(self, value: Any) -> Optional[float]:
        """Parse currency string to float."""
        if not value:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        
        # Remove currency symbols and commas
        cleaned = re.sub(r'[$,]', '', str(value))
        
        try:
            return float(cleaned)
        except ValueError:
            return None
    
    def extract_categories(self, data: Dict) -> List[str]:
        """Extract and normalize categories from content."""
        categories = set()
        
        # Check explicit categories
        if 'categories' in data:
            for cat in data['categories']:
                categories.add(cat)
        
        # Extract from title and description
        text = f"{data.get('title', '')} {data.get('description', '')}".lower()
        
        for keyword, category in self.CATEGORY_MAPPING.items():
            if keyword in text:
                categories.add(category)
        
        return list(categories)
    
    def extract_naics(self, data: Dict) -> List[str]:
        """Extract NAICS codes."""
        naics = []
        
        if 'naics_codes' in data:
            naics.extend(data['naics_codes'])
        
        # Look for NAICS patterns in text
        text = f"{data.get('title', '')} {data.get('description', '')}"
        pattern = r'\b(\d{6})\b'  # 6-digit NAICS
        matches = re.findall(pattern, text)
        naics.extend(matches)
        
        return list(set(naics))
    
    def determine_contract_type(self, data: Dict) -> str:
        """Determine contract type (IFB, RFP, RFQ, etc.)."""
        title = data.get('title', '').upper()
        
        if 'IFB' in title or 'INVITATION FOR BID' in title:
            return 'IFB'
        elif 'RFP' in title or 'REQUEST FOR PROPOSAL' in title:
            return 'RFP'
        elif 'RFQ' in title or 'REQUEST FOR QUOTE' in title:
            return 'RFQ'
        elif 'RFI' in title or 'REQUEST FOR INFORMATION' in title:
            return 'RFI'
        
        return 'other'
    
    def check_bonding(self, data: Dict) -> bool:
        """Check if bonding is required."""
        text = f"{data.get('title', '')} {data.get('description', '')}".lower()
        return 'bond' in text or 'bonding' in text
    
    def check_certification_required(self, data: Dict) -> bool:
        """Check if specific certifications are required."""
        certs = self.extract_required_certs(data)
        return len(certs) > 0
    
    def extract_required_certs(self, data: Dict) -> List[str]:
        """Extract required certifications."""
        certs = []
        text = f"{data.get('title', '')} {data.get('description', '')}".upper()
        
        cert_patterns = [
            (r'\bMBE\b', 'MBE'),
            (r'\bWBE\b', 'WBE'),
            (r'\bDBE\b', 'DBE'),
            (r'\bVBE\b', 'VBE'),
            (r'\bSDVOBE\b', 'SDVOBE'),
            (r'MINORITY.?OWNED', 'MBE'),
            (r'WOMAN.?OWNED', 'WBE'),
            (r'VETERAN.?OWNED', 'VBE'),
        ]
        
        for pattern, cert in cert_patterns:
            if re.search(pattern, text):
                certs.append(cert)
        
        return list(set(certs))
    
    def extract_set_asides(self, data: Dict) -> List[str]:
        """Extract set-aside designations."""
        set_asides = []
        text = f"{data.get('title', '')} {data.get('description', '')}".lower()
        
        if 'small business' in text:
            set_asides.append('small_business')
        if 'mbe' in text or 'minority' in text:
            set_asides.append('mbe')
        if 'wbe' in text or 'women' in text or 'woman' in text:
            set_asides.append('wbe')
        if 'veteran' in text:
            set_asides.append('veteran')
        if 'disadvantaged' in text or 'dbe' in text:
            set_asides.append('dbe')
        
        return list(set(set_asides))
    
    def determine_status(self, data: Dict) -> str:
        """Determine contract status."""
        status = data.get('status', '').lower()
        
        if status in ['open', 'active', 'accepting bids']:
            return 'open'
        elif status in ['closed', 'closed for bids']:
            return 'closed'
        elif status in ['awarded', 'award']:
            return 'awarded'
        elif status in ['cancelled', 'canceled']:
            return 'cancelled'
        
        # Check deadline
        deadline = self.parse_datetime(data.get('deadline'))
        if deadline and deadline < datetime.now():
            return 'closed'
        
        return 'open'
```

---

## Scheduler Configuration

```python
# backend/workers/celery_config.py

from celery import Celery
from celery.schedules import crontab

app = Celery('bidscout')

app.conf.beat_schedule = {
    # High priority - every 4 hours
    'scrape-commbuys': {
        'task': 'workers.tasks.scrape_source',
        'schedule': crontab(minute=0, hour='*/4'),
        'args': ('commbuys',)
    },
    'scrape-boston': {
        'task': 'workers.tasks.scrape_source',
        'schedule': crontab(minute=15, hour='*/4'),
        'args': ('boston',)
    },
    
    # Medium priority - every 8 hours
    'scrape-cambridge': {
        'task': 'workers.tasks.scrape_source',
        'schedule': crontab(minute=30, hour='*/8'),
        'args': ('cambridge',)
    },
    'scrape-worcester': {
        'task': 'workers.tasks.scrape_source',
        'schedule': crontab(minute=45, hour='*/8'),
        'args': ('worcester',)
    },
    
    # Daily
    'scrape-springfield': {
        'task': 'workers.tasks.scrape_source',
        'schedule': crontab(minute=0, hour=9),
        'args': ('springfield',)
    },
    
    # Run matching after scraping
    'run-matching': {
        'task': 'workers.tasks.run_matching',
        'schedule': crontab(minute=0, hour='*/4'),
    },
    
    # Send daily digests
    'send-daily-digest': {
        'task': 'workers.tasks.send_daily_digest',
        'schedule': crontab(minute=0, hour=8),  # 8 AM
    },
    
    # Check for expiring documents
    'check-expirations': {
        'task': 'workers.tasks.check_document_expirations',
        'schedule': crontab(minute=0, hour=7),  # 7 AM daily
    },
}
```

---

## Error Handling & Monitoring

```python
# backend/scrapers/monitoring.py

import logging
from datetime import datetime
from typing import Dict, Any

import sentry_sdk  # Optional: error tracking

logger = logging.getLogger(__name__)


class ScraperMonitor:
    """Monitors scraper health and performance."""
    
    def __init__(self):
        self.metrics = {}
    
    def record_run(self, source: str, result: Dict[str, Any]):
        """Record scraper run metrics."""
        self.metrics[source] = {
            'last_run': datetime.utcnow(),
            'duration': result.get('duration_seconds'),
            'items_found': result.get('listings_found'),
            'new': result.get('new'),
            'updated': result.get('updated'),
            'errors': result.get('errors'),
            'success': result.get('errors', 0) == 0
        }
        
        # Log summary
        logger.info(
            f"Scraper [{source}] completed: "
            f"{result.get('new', 0)} new, "
            f"{result.get('updated', 0)} updated, "
            f"{result.get('errors', 0)} errors"
        )
        
        # Alert on high error rate
        if result.get('errors', 0) > 5:
            self.alert_high_errors(source, result)
    
    def record_failure(self, source: str, error: Exception):
        """Record scraper failure."""
        self.metrics[source] = {
            'last_run': datetime.utcnow(),
            'success': False,
            'error': str(error)
        }
        
        logger.error(f"Scraper [{source}] failed: {error}")
        
        # Send to error tracking
        sentry_sdk.capture_exception(error)
    
    def alert_high_errors(self, source: str, result: Dict):
        """Alert when error rate is high."""
        # Send alert (email, Slack, etc.)
        pass
    
    def get_health(self) -> Dict[str, Any]:
        """Get overall scraper health status."""
        return {
            source: {
                'healthy': data.get('success', False),
                'last_run': data.get('last_run'),
                'error': data.get('error')
            }
            for source, data in self.metrics.items()
        }
```

---

## Testing Scrapers

```python
# backend/tests/test_scrapers.py

import pytest
from unittest.mock import Mock, patch

from scrapers.boston import BostonScraper
from scrapers.normalizer import ContractNormalizer


class TestBostonScraper:
    """Tests for Boston scraper."""
    
    @pytest.fixture
    def sample_html(self):
        return """
        <article class="node--type-bid">
            <h2><a href="/bid-listings/ev00016920">Test Bid Title</a></h2>
            <div class="field--name-field-bid-number">EV00016920</div>
            <div class="field--name-field-closing-date">01/15/2026 12:00 PM</div>
        </article>
        """
    
    def test_parse_listing(self, sample_html):
        """Test parsing of bid listing."""
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(sample_html, 'html.parser')
        
        scraper = BostonScraper(Mock())
        result = scraper.parse_listing(soup)
        
        assert result['title'] == 'Test Bid Title'
        assert result['external_id'] == 'EV00016920'
        assert 'ev00016920' in result['url']


class TestContractNormalizer:
    """Tests for contract normalizer."""
    
    def test_parse_date(self):
        normalizer = ContractNormalizer()
        
        assert normalizer.parse_date('01/15/2026').isoformat() == '2026-01-15'
        assert normalizer.parse_date('2026-01-15').isoformat() == '2026-01-15'
        assert normalizer.parse_date('January 15, 2026').isoformat() == '2026-01-15'
    
    def test_extract_categories(self):
        normalizer = ContractNormalizer()
        
        data = {'title': 'IT Consulting Services for Software Development'}
        categories = normalizer.extract_categories(data)
        
        assert 'IT Services' in categories
        assert 'Software Development' in categories
    
    def test_extract_set_asides(self):
        normalizer = ContractNormalizer()
        
        data = {'description': 'This is a Small Business set-aside for MBE/WBE firms'}
        set_asides = normalizer.extract_set_asides(data)
        
        assert 'small_business' in set_asides
        assert 'mbe' in set_asides
        assert 'wbe' in set_asides
```

---

## Running Scrapers Locally

```bash
# Install dependencies
pip install playwright beautifulsoup4 aiohttp

# Install Playwright browsers
playwright install chromium

# Run single scraper
python -m scrapers.run --source boston

# Run all scrapers
python -m scrapers.run --all

# Test scraper without saving
python -m scrapers.run --source boston --dry-run
```
