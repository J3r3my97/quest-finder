# Matching Algorithm

## Overview

The matching algorithm connects contracts to businesses based on multiple criteria. The goal is to surface contracts each business can **actually win** - not just contracts that mention their keywords.

## Matching Philosophy

1. **Relevance over volume** - Better to show 5 great matches than 50 mediocre ones
2. **Qualification-aware** - Don't show contracts they can't bid on
3. **Transparent scoring** - Users should understand why they're seeing each match
4. **Learn from behavior** - Improve based on what users save, dismiss, and bid on

---

## Scoring Components

Each match is scored from 0.0 to 1.0 based on weighted components:

| Component | Weight | Description |
|-----------|--------|-------------|
| Service Match | 30% | How well services align |
| Location Match | 20% | Geographic fit |
| Size Match | 15% | Contract value vs. business capacity |
| Certification Match | 20% | Required certs vs. held certs |
| Experience Match | 10% | Past performance alignment |
| Recency Bonus | 5% | Newer postings get slight boost |

```
Final Score = Σ (component_score × weight)
```

---

## Component Details

### 1. Service Match (30%)

Compares business service types/keywords with contract categories and description.

```python
# backend/services/matching/service_match.py

from typing import List, Set
import re


def calculate_service_match(
    business_services: List[str],
    business_keywords: List[str],
    business_naics: List[str],
    contract_categories: List[str],
    contract_naics: List[str],
    contract_title: str,
    contract_description: str
) -> tuple[float, List[str]]:
    """
    Calculate service alignment score.
    
    Returns: (score 0.0-1.0, list of match reasons)
    """
    score = 0.0
    reasons = []
    
    # 1. NAICS code match (exact match is strong signal) - 40% of component
    if contract_naics:
        naics_overlap = set(business_naics) & set(contract_naics)
        if naics_overlap:
            naics_score = len(naics_overlap) / len(contract_naics)
            score += 0.4 * naics_score
            reasons.append(f"NAICS codes match: {', '.join(naics_overlap)}")
    else:
        # No NAICS specified, give partial credit
        score += 0.2
    
    # 2. Category match - 30% of component
    if contract_categories:
        cat_overlap = set(business_services) & set(contract_categories)
        if cat_overlap:
            cat_score = len(cat_overlap) / len(contract_categories)
            score += 0.3 * cat_score
            reasons.append(f"Services align: {', '.join(cat_overlap)}")
    
    # 3. Keyword match in title/description - 30% of component
    contract_text = f"{contract_title} {contract_description}".lower()
    
    # Check business keywords against contract text
    matched_keywords = []
    for keyword in business_keywords:
        if keyword.lower() in contract_text:
            matched_keywords.append(keyword)
    
    # Check service types as keywords too
    for service in business_services:
        if service.lower() in contract_text:
            matched_keywords.append(service)
    
    if matched_keywords:
        # Cap at 5 keywords for scoring
        keyword_score = min(len(set(matched_keywords)), 5) / 5
        score += 0.3 * keyword_score
        if matched_keywords:
            reasons.append(f"Keywords found: {', '.join(list(set(matched_keywords))[:3])}")
    
    return score, reasons


def extract_keywords_from_text(text: str, top_n: int = 10) -> List[str]:
    """Extract potential keywords from contract text for matching."""
    # Simple extraction - could be enhanced with NLP
    stop_words = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
        'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this',
        'that', 'these', 'those', 'it', 'its', 'services', 'contract', 'bid',
        'proposal', 'rfp', 'ifb', 'request', 'city', 'state', 'massachusetts'
    }
    
    words = re.findall(r'\b[a-z]{3,}\b', text.lower())
    word_freq = {}
    
    for word in words:
        if word not in stop_words:
            word_freq[word] = word_freq.get(word, 0) + 1
    
    sorted_words = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)
    return [word for word, _ in sorted_words[:top_n]]
```

### 2. Location Match (20%)

Checks if contract location is within business service area.

```python
# backend/services/matching/location_match.py

from typing import List, Optional
from math import radians, cos, sin, asin, sqrt

# Massachusetts city coordinates (approximate)
MA_CITY_COORDS = {
    'boston': (42.3601, -71.0589),
    'cambridge': (42.3736, -71.1097),
    'worcester': (42.2626, -71.8023),
    'springfield': (42.1015, -72.5898),
    'lowell': (42.6334, -71.3162),
    'brockton': (42.0834, -71.0184),
    'quincy': (42.2529, -71.0023),
    'lynn': (42.4668, -70.9495),
    'new bedford': (41.6362, -70.9342),
    'fall river': (41.7015, -71.1550),
    # Add more as needed
}


def calculate_location_match(
    business_city: str,
    business_state: str,
    business_radius_miles: int,
    business_service_areas: Optional[List[str]],
    contract_city: str,
    contract_state: str,
    contract_service_area: Optional[List[str]]
) -> tuple[float, List[str]]:
    """
    Calculate geographic fit score.
    
    Returns: (score 0.0-1.0, list of match reasons)
    """
    reasons = []
    
    # Different state = no match (for now, MA only)
    if contract_state and contract_state.upper() != 'MA':
        return 0.0, ["Contract outside Massachusetts"]
    
    # Exact city match
    if business_city and contract_city:
        if business_city.lower() == contract_city.lower():
            reasons.append(f"Located in {contract_city}")
            return 1.0, reasons
    
    # Check explicit service areas
    if business_service_areas and contract_city:
        if contract_city.lower() in [a.lower() for a in business_service_areas]:
            reasons.append(f"{contract_city} in service area")
            return 1.0, reasons
    
    # Calculate distance if coordinates available
    if business_city and contract_city:
        business_coords = MA_CITY_COORDS.get(business_city.lower())
        contract_coords = MA_CITY_COORDS.get(contract_city.lower())
        
        if business_coords and contract_coords:
            distance = haversine_distance(business_coords, contract_coords)
            
            if distance <= business_radius_miles:
                # Score decreases with distance
                score = 1.0 - (distance / business_radius_miles) * 0.5
                reasons.append(f"{contract_city} is {distance:.0f} miles away")
                return score, reasons
            else:
                return 0.0, [f"{contract_city} outside service radius ({distance:.0f} miles)"]
    
    # Statewide contract or unknown location - partial credit
    if not contract_city:
        reasons.append("Statewide contract")
        return 0.7, reasons
    
    # Can't determine - give moderate score
    return 0.5, ["Location match uncertain"]


def haversine_distance(coord1: tuple, coord2: tuple) -> float:
    """Calculate distance between two coordinates in miles."""
    lat1, lon1 = coord1
    lat2, lon2 = coord2
    
    R = 3956  # Earth's radius in miles
    
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    
    return R * c
```

### 3. Size Match (15%)

Compares contract value with business's target range and capacity.

```python
# backend/services/matching/size_match.py

from typing import Optional
from decimal import Decimal


def calculate_size_match(
    business_size_min: Optional[Decimal],
    business_size_max: Optional[Decimal],
    business_employees: Optional[int],
    business_revenue: Optional[Decimal],
    contract_value_min: Optional[Decimal],
    contract_value_max: Optional[Decimal]
) -> tuple[float, List[str]]:
    """
    Calculate contract size fit score.
    
    Considers:
    - Explicit size preferences
    - Implied capacity from business size
    
    Returns: (score 0.0-1.0, list of match reasons)
    """
    reasons = []
    
    # No contract value known - moderate score
    if not contract_value_min and not contract_value_max:
        return 0.7, ["Contract value not specified"]
    
    contract_value = contract_value_max or contract_value_min
    
    # Check against explicit preferences
    if business_size_min and business_size_max:
        if business_size_min <= contract_value <= business_size_max:
            reasons.append(f"Contract value ${contract_value:,.0f} within target range")
            return 1.0, reasons
        elif contract_value < business_size_min:
            # Too small - might still be worth pursuing
            ratio = float(contract_value / business_size_min)
            if ratio > 0.5:
                reasons.append(f"Contract slightly below target (${contract_value:,.0f})")
                return 0.7, reasons
            else:
                reasons.append(f"Contract too small (${contract_value:,.0f})")
                return 0.3, reasons
        else:
            # Too large - more concerning
            ratio = float(business_size_max / contract_value)
            if ratio > 0.5:
                reasons.append(f"Contract above typical range (${contract_value:,.0f})")
                return 0.5, reasons
            else:
                reasons.append(f"Contract may be too large (${contract_value:,.0f})")
                return 0.2, reasons
    
    # Infer capacity from business size
    if business_employees:
        # Rule of thumb: annual capacity ~= employees * $100-200K
        estimated_capacity = business_employees * 150000
        
        if contract_value <= estimated_capacity:
            reasons.append(f"Contract size appropriate for team size")
            return 0.8, reasons
        else:
            reasons.append(f"Large contract for team size")
            return 0.4, reasons
    
    # Can't determine - neutral
    return 0.6, ["Size fit uncertain"]
```

### 4. Certification Match (20%)

Critical component - checks required certifications against held certifications.

```python
# backend/services/matching/certification_match.py

from typing import List, Dict, Any, Optional


def calculate_certification_match(
    business_certifications: List[Dict[str, Any]],
    business_demographics: Dict[str, Any],
    contract_required_certs: List[str],
    contract_set_asides: List[str],
    contract_is_set_aside: bool
) -> tuple[float, List[str], List[str]]:
    """
    Calculate certification alignment score.
    
    Returns: (score 0.0-1.0, match reasons, missing requirements)
    """
    reasons = []
    missing = []
    
    # Extract held certification codes
    held_certs = {cert['type'].upper() for cert in business_certifications if cert.get('verified', True)}
    
    # No certifications required - full score
    if not contract_required_certs and not contract_is_set_aside:
        return 1.0, ["No certifications required"], []
    
    # Check required certifications
    if contract_required_certs:
        required_set = {c.upper() for c in contract_required_certs}
        matched = held_certs & required_set
        missing_certs = required_set - held_certs
        
        if missing_certs:
            missing.extend([f"Requires {cert} certification" for cert in missing_certs])
        
        if matched:
            reasons.append(f"Holds required: {', '.join(matched)}")
        
        if not missing_certs:
            return 1.0, reasons, missing
        else:
            # Some required certs missing - significant penalty
            return 0.2, reasons, missing
    
    # Check set-asides (preferred but not always required)
    if contract_set_asides:
        set_aside_map = {
            'mbe': 'MBE',
            'wbe': 'WBE',
            'dbe': 'DBE',
            'small_business': 'SBE',
            'veteran': 'VBE',
            'sdvobe': 'SDVOBE'
        }
        
        for set_aside in contract_set_asides:
            cert_code = set_aside_map.get(set_aside.lower())
            if cert_code and cert_code in held_certs:
                reasons.append(f"{cert_code} certification matches set-aside")
                return 1.0, reasons, missing
        
        # Check if business COULD qualify based on demographics
        potential_matches = check_potential_eligibility(business_demographics, contract_set_asides)
        
        if potential_matches:
            reasons.append(f"May qualify for: {', '.join(potential_matches)}")
            missing.append(f"Consider applying for {', '.join(potential_matches)} certification")
            return 0.6, reasons, missing
        
        # Set-aside but no matching cert
        if contract_is_set_aside:
            missing.append(f"Contract is set-aside for {', '.join(contract_set_asides)}")
            return 0.1, reasons, missing
        else:
            # Preferred but not required
            reasons.append("Set-aside preference - non-certified may still bid")
            return 0.7, reasons, missing
    
    return 0.8, reasons, missing


def check_potential_eligibility(
    demographics: Dict[str, Any],
    set_asides: List[str]
) -> List[str]:
    """Check if business demographics suggest certification eligibility."""
    potential = []
    
    if not demographics:
        return potential
    
    for set_aside in set_asides:
        if set_aside == 'mbe' and demographics.get('minority_owned'):
            potential.append('MBE')
        elif set_aside == 'wbe' and demographics.get('woman_owned'):
            potential.append('WBE')
        elif set_aside in ('veteran', 'vbe') and demographics.get('veteran_owned'):
            potential.append('VBE')
        elif set_aside == 'sdvobe' and demographics.get('service_disabled_veteran_owned'):
            potential.append('SDVOBE')
    
    return potential
```

### 5. Experience Match (10%)

Checks if business has relevant past performance.

```python
# backend/services/matching/experience_match.py

from typing import List, Dict, Any


def calculate_experience_match(
    business_years: int,
    business_past_contracts: List[Dict[str, Any]],  # Future: track won contracts
    contract_entity_type: str,
    contract_categories: List[str],
    contract_value: float
) -> tuple[float, List[str]]:
    """
    Calculate experience alignment score.
    
    For MVP, this is simplified. Future versions will track
    actual won contracts and past performance.
    
    Returns: (score 0.0-1.0, list of reasons)
    """
    reasons = []
    score = 0.5  # Base score
    
    # Years in business
    if business_years:
        if business_years >= 5:
            score += 0.2
            reasons.append(f"{business_years} years in business")
        elif business_years >= 2:
            score += 0.1
            reasons.append(f"{business_years} years in business")
        else:
            reasons.append("Newer business - building track record")
    
    # Past contracts with similar entities (future feature)
    if business_past_contracts:
        similar_entity_contracts = [
            c for c in business_past_contracts
            if c.get('entity_type') == contract_entity_type
        ]
        
        if similar_entity_contracts:
            score += 0.2
            reasons.append(f"Prior {contract_entity_type} contracts")
        
        # Similar categories
        for past in business_past_contracts:
            if set(past.get('categories', [])) & set(contract_categories):
                score += 0.1
                reasons.append("Similar past work")
                break
    
    return min(score, 1.0), reasons
```

### 6. Recency Bonus (5%)

Slight boost for newer postings to surface fresh opportunities.

```python
# backend/services/matching/recency.py

from datetime import datetime, timedelta


def calculate_recency_bonus(posted_date: datetime) -> tuple[float, str]:
    """
    Calculate recency bonus score.
    
    Returns: (score 0.0-1.0, reason)
    """
    if not posted_date:
        return 0.5, ""
    
    days_old = (datetime.utcnow() - posted_date).days
    
    if days_old <= 1:
        return 1.0, "Posted today"
    elif days_old <= 3:
        return 0.9, "Posted this week"
    elif days_old <= 7:
        return 0.7, ""
    elif days_old <= 14:
        return 0.5, ""
    else:
        return 0.3, ""
```

---

## Main Matching Engine

```python
# backend/services/matching/engine.py

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from decimal import Decimal

from app.models import Business, Contract, Match
from app.db import get_db

from .service_match import calculate_service_match
from .location_match import calculate_location_match
from .size_match import calculate_size_match
from .certification_match import calculate_certification_match
from .experience_match import calculate_experience_match
from .recency import calculate_recency_bonus


@dataclass
class MatchResult:
    contract_id: str
    score: float
    score_breakdown: Dict[str, float]
    match_reasons: List[str]
    missing_requirements: List[str]
    should_notify: bool


class MatchingEngine:
    """
    Core matching engine that scores contracts against businesses.
    """
    
    # Component weights
    WEIGHTS = {
        'service': 0.30,
        'location': 0.20,
        'size': 0.15,
        'certification': 0.20,
        'experience': 0.10,
        'recency': 0.05
    }
    
    # Minimum score to create a match
    MIN_SCORE_THRESHOLD = 0.4
    
    # Score threshold for notifications
    NOTIFICATION_THRESHOLD = 0.6
    
    def __init__(self):
        self.db = get_db()
    
    async def match_business_to_contracts(
        self,
        business: Business,
        contracts: List[Contract] = None,
        limit: int = 100
    ) -> List[MatchResult]:
        """
        Find matching contracts for a business.
        
        If contracts not provided, queries open contracts from DB.
        """
        if contracts is None:
            contracts = await self.get_open_contracts()
        
        results = []
        
        for contract in contracts:
            result = self.score_match(business, contract)
            
            if result.score >= self.MIN_SCORE_THRESHOLD:
                results.append(result)
        
        # Sort by score descending
        results.sort(key=lambda x: x.score, reverse=True)
        
        return results[:limit]
    
    async def match_contract_to_businesses(
        self,
        contract: Contract,
        businesses: List[Business] = None
    ) -> List[MatchResult]:
        """
        Find matching businesses for a contract.
        Used when new contract is scraped.
        """
        if businesses is None:
            businesses = await self.get_active_businesses()
        
        results = []
        
        for business in businesses:
            result = self.score_match(business, contract)
            
            if result.score >= self.MIN_SCORE_THRESHOLD:
                results.append(result)
        
        return results
    
    def score_match(self, business: Business, contract: Contract) -> MatchResult:
        """
        Calculate match score between a business and contract.
        """
        scores = {}
        all_reasons = []
        all_missing = []
        
        # 1. Service Match
        service_score, service_reasons = calculate_service_match(
            business_services=business.service_types,
            business_keywords=business.service_keywords or [],
            business_naics=business.naics_codes,
            contract_categories=contract.categories,
            contract_naics=contract.naics_codes,
            contract_title=contract.title,
            contract_description=contract.description or ""
        )
        scores['service'] = service_score
        all_reasons.extend(service_reasons)
        
        # 2. Location Match
        location_score, location_reasons = calculate_location_match(
            business_city=business.address_city,
            business_state=business.address_state,
            business_radius_miles=business.service_radius_miles or 50,
            business_service_areas=business.service_areas,
            contract_city=contract.location_city,
            contract_state=contract.location_state,
            contract_service_area=contract.service_area
        )
        scores['location'] = location_score
        all_reasons.extend(location_reasons)
        
        # 3. Size Match
        size_score, size_reasons = calculate_size_match(
            business_size_min=business.contract_size_min,
            business_size_max=business.contract_size_max,
            business_employees=business.employee_count_max,
            business_revenue=business.annual_revenue_max,
            contract_value_min=contract.estimated_value_min,
            contract_value_max=contract.estimated_value_max
        )
        scores['size'] = size_score
        all_reasons.extend(size_reasons)
        
        # 4. Certification Match
        cert_score, cert_reasons, cert_missing = calculate_certification_match(
            business_certifications=business.certifications or [],
            business_demographics=business.ownership_demographics or {},
            contract_required_certs=contract.required_certifications,
            contract_set_asides=contract.set_asides,
            contract_is_set_aside=contract.is_set_aside
        )
        scores['certification'] = cert_score
        all_reasons.extend(cert_reasons)
        all_missing.extend(cert_missing)
        
        # 5. Experience Match
        exp_score, exp_reasons = calculate_experience_match(
            business_years=business.years_in_business or 0,
            business_past_contracts=[],  # Future feature
            contract_entity_type=contract.entity_type,
            contract_categories=contract.categories,
            contract_value=float(contract.estimated_value_max or 0)
        )
        scores['experience'] = exp_score
        all_reasons.extend(exp_reasons)
        
        # 6. Recency Bonus
        recency_score, recency_reason = calculate_recency_bonus(contract.posted_date)
        scores['recency'] = recency_score
        if recency_reason:
            all_reasons.append(recency_reason)
        
        # Calculate weighted final score
        final_score = sum(
            scores[component] * weight
            for component, weight in self.WEIGHTS.items()
        )
        
        # Check for disqualifying factors
        if cert_score < 0.2 and contract.is_set_aside:
            # Can't bid on set-aside without certification
            final_score *= 0.5
            all_missing.insert(0, "⚠️ Set-aside contract - certification required")
        
        if location_score == 0:
            # Outside service area
            final_score *= 0.3
        
        return MatchResult(
            contract_id=str(contract.id),
            score=round(final_score, 4),
            score_breakdown=scores,
            match_reasons=[r for r in all_reasons if r],
            missing_requirements=all_missing,
            should_notify=final_score >= self.NOTIFICATION_THRESHOLD
        )
    
    async def get_open_contracts(self) -> List[Contract]:
        """Get all open contracts from database."""
        # Implementation depends on your DB setup
        pass
    
    async def get_active_businesses(self) -> List[Business]:
        """Get all businesses with matching enabled."""
        # Implementation depends on your DB setup
        pass
    
    async def save_matches(self, business_id: str, results: List[MatchResult]):
        """Save match results to database."""
        for result in results:
            # Check if match already exists
            existing = await self.db.matches.find_one({
                'business_id': business_id,
                'contract_id': result.contract_id
            })
            
            if existing:
                # Update score if changed significantly
                if abs(existing['score'] - result.score) > 0.05:
                    await self.db.matches.update_one(
                        {'_id': existing['_id']},
                        {'$set': {
                            'score': result.score,
                            'score_breakdown': result.score_breakdown,
                            'match_reasons': result.match_reasons,
                            'missing_requirements': result.missing_requirements,
                            'updated_at': datetime.utcnow()
                        }}
                    )
            else:
                # Create new match
                await self.db.matches.insert_one({
                    'business_id': business_id,
                    'contract_id': result.contract_id,
                    'score': result.score,
                    'score_breakdown': result.score_breakdown,
                    'match_reasons': result.match_reasons,
                    'missing_requirements': result.missing_requirements,
                    'status': 'new',
                    'created_at': datetime.utcnow()
                })
```

---

## Running the Matcher

### On New Contract

```python
# backend/workers/tasks.py

from celery import shared_task
from services.matching.engine import MatchingEngine
from services.notifications import NotificationService


@shared_task
def process_new_contract(contract_id: str):
    """
    Process a newly scraped contract.
    Find matching businesses and notify them.
    """
    engine = MatchingEngine()
    notifications = NotificationService()
    
    contract = await engine.db.contracts.find_one({'_id': contract_id})
    if not contract:
        return
    
    # Find matching businesses
    matches = await engine.match_contract_to_businesses(contract)
    
    # Save matches and queue notifications
    for match in matches:
        await engine.save_matches(match.business_id, [match])
        
        if match.should_notify:
            notifications.queue_new_match_notification(
                business_id=match.business_id,
                contract_id=contract_id,
                score=match.score,
                reasons=match.match_reasons
            )
```

### Scheduled Full Matching

```python
@shared_task
def run_full_matching():
    """
    Run matching for all active businesses.
    Scheduled to run after scraping completes.
    """
    engine = MatchingEngine()
    
    businesses = await engine.get_active_businesses()
    
    for business in businesses:
        matches = await engine.match_business_to_contracts(business)
        await engine.save_matches(str(business.id), matches)
        
        # Update business last_matched_at
        await engine.db.businesses.update_one(
            {'_id': business.id},
            {'$set': {'last_matched_at': datetime.utcnow()}}
        )
```

---

## API Endpoints

```python
# backend/app/api/matches.py

from fastapi import APIRouter, Depends, Query
from typing import List, Optional

from app.auth import get_current_user
from app.schemas import MatchResponse, MatchFilters
from services.matching.engine import MatchingEngine

router = APIRouter(prefix="/matches", tags=["matches"])


@router.get("/", response_model=List[MatchResponse])
async def get_matches(
    status: Optional[str] = Query(None, enum=['new', 'viewed', 'saved', 'dismissed']),
    min_score: float = Query(0.4, ge=0, le=1),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
    user = Depends(get_current_user)
):
    """Get matched contracts for user's business."""
    business = await get_user_business(user.id)
    
    query = {
        'business_id': str(business.id),
        'score': {'$gte': min_score}
    }
    
    if status:
        query['status'] = status
    
    matches = await db.matches.find(query) \
        .sort('score', -1) \
        .skip(offset) \
        .limit(limit) \
        .to_list()
    
    # Expand contract details
    return await expand_match_details(matches)


@router.post("/{match_id}/view")
async def mark_viewed(match_id: str, user = Depends(get_current_user)):
    """Mark a match as viewed."""
    await db.matches.update_one(
        {'_id': match_id},
        {'$set': {'status': 'viewed', 'viewed_at': datetime.utcnow()}}
    )
    return {"status": "ok"}


@router.post("/{match_id}/save")
async def save_match(match_id: str, user = Depends(get_current_user)):
    """Save a match for later."""
    await db.matches.update_one(
        {'_id': match_id},
        {'$set': {'saved': True, 'saved_at': datetime.utcnow()}}
    )
    return {"status": "ok"}


@router.post("/{match_id}/dismiss")
async def dismiss_match(
    match_id: str,
    reason: Optional[str] = None,
    user = Depends(get_current_user)
):
    """Dismiss a match (won't show again)."""
    await db.matches.update_one(
        {'_id': match_id},
        {'$set': {
            'status': 'dismissed',
            'dismissed': True,
            'dismissed_at': datetime.utcnow(),
            'dismissed_reason': reason
        }}
    )
    return {"status": "ok"}


@router.get("/stats")
async def get_match_stats(user = Depends(get_current_user)):
    """Get match statistics for dashboard."""
    business = await get_user_business(user.id)
    
    pipeline = [
        {'$match': {'business_id': str(business.id)}},
        {'$group': {
            '_id': '$status',
            'count': {'$sum': 1}
        }}
    ]
    
    results = await db.matches.aggregate(pipeline).to_list()
    
    return {
        'total': sum(r['count'] for r in results),
        'by_status': {r['_id']: r['count'] for r in results}
    }
```

---

## Future Enhancements

### Machine Learning Scoring (v2)

```python
# Future: ML-based scoring model

class MLMatchingEngine(MatchingEngine):
    """
    Enhanced matching using ML model trained on user behavior.
    """
    
    def __init__(self):
        super().__init__()
        self.model = load_model('match_scoring_model.pkl')
    
    def score_match(self, business: Business, contract: Contract) -> MatchResult:
        # Get base scores
        base_result = super().score_match(business, contract)
        
        # Extract features for ML model
        features = self.extract_features(business, contract, base_result)
        
        # Predict score adjustment
        ml_score = self.model.predict([features])[0]
        
        # Blend base and ML scores
        final_score = 0.6 * base_result.score + 0.4 * ml_score
        
        return MatchResult(
            contract_id=base_result.contract_id,
            score=final_score,
            score_breakdown={**base_result.score_breakdown, 'ml_adjustment': ml_score},
            match_reasons=base_result.match_reasons,
            missing_requirements=base_result.missing_requirements,
            should_notify=final_score >= self.NOTIFICATION_THRESHOLD
        )
    
    def extract_features(self, business, contract, base_result):
        """Extract features for ML model."""
        return [
            base_result.score,
            base_result.score_breakdown['service'],
            base_result.score_breakdown['location'],
            base_result.score_breakdown['certification'],
            len(business.certifications),
            business.employee_count_max or 0,
            float(contract.estimated_value_max or 0),
            # ... more features
        ]
```

### Win Probability (v2)

Once we have historical award data, we can predict win probability:

```python
def calculate_win_probability(
    business: Business,
    contract: Contract,
    historical_awards: List[Award]
) -> float:
    """
    Estimate probability of winning based on:
    - Similar contracts won by similar businesses
    - Competition level (how many typically bid)
    - Business qualifications vs. typical winners
    """
    pass
```
