# API Specification

## Overview

BidScout uses a REST API built with FastAPI. This document specifies all endpoints, request/response schemas, and authentication.

## Base URL

```
Production: https://api.bidscout.com/v1
Development: http://localhost:8000/v1
```

## Authentication

All authenticated endpoints require a Bearer token in the Authorization header:

```
Authorization: Bearer <token>
```

Tokens are obtained through the auth provider (Clerk/Supabase) and validated on each request.

---

## Schemas

### Pydantic Models

```python
# backend/app/schemas.py

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from enum import Enum


# Enums
class EntityType(str, Enum):
    STATE = "state"
    CITY = "city"
    COUNTY = "county"
    SCHOOL_DISTRICT = "school_district"
    UNIVERSITY = "university"
    UTILITY = "utility"
    TRANSIT = "transit"
    HOSPITAL = "hospital"


class ContractStatus(str, Enum):
    OPEN = "open"
    CLOSED = "closed"
    AWARDED = "awarded"
    CANCELLED = "cancelled"


class MatchStatus(str, Enum):
    NEW = "new"
    VIEWED = "viewed"
    SAVED = "saved"
    DISMISSED = "dismissed"
    APPLIED = "applied"


class DocType(str, Enum):
    W9 = "w9"
    COI = "coi"
    BUSINESS_LICENSE = "business_license"
    CERTIFICATION_MBE = "certification_mbe"
    CERTIFICATION_WBE = "certification_wbe"
    CERTIFICATION_VBE = "certification_vbe"
    CERTIFICATION_DBE = "certification_dbe"
    BOND_LETTER = "bond_letter"
    CAPABILITY_STATEMENT = "capability_statement"
    OTHER = "other"


# Base Models
class Address(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: str = "MA"
    zip: Optional[str] = None


class ValueRange(BaseModel):
    min: Optional[float] = None
    max: Optional[float] = None


class Certification(BaseModel):
    type: str
    issuer: Optional[str] = None
    number: Optional[str] = None
    expiration: Optional[date] = None
    verified: bool = False


# Business Schemas
class BusinessCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    website: Optional[str] = None
    address: Optional[Address] = None
    service_types: List[str] = []
    naics_codes: List[str] = []
    employee_count: Optional[ValueRange] = None
    annual_revenue: Optional[ValueRange] = None


class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    website: Optional[str] = None
    address: Optional[Address] = None
    service_types: Optional[List[str]] = None
    service_radius_miles: Optional[int] = None
    naics_codes: Optional[List[str]] = None
    employee_count: Optional[ValueRange] = None
    annual_revenue: Optional[ValueRange] = None
    contract_preferences: Optional[Dict[str, Any]] = None


class BusinessResponse(BaseModel):
    id: str
    user_id: str
    name: str
    legal_name: Optional[str]
    description: Optional[str]
    website: Optional[str]
    address: Optional[Address]
    service_radius_miles: int
    service_types: List[str]
    naics_codes: List[str]
    employee_count: Optional[ValueRange]
    annual_revenue: Optional[ValueRange]
    certifications: List[Certification]
    contract_preferences: Optional[Dict[str, Any]]
    matching_enabled: bool
    created_at: datetime
    updated_at: datetime


# Contract Schemas
class ContractListItem(BaseModel):
    id: str
    title: str
    entity_name: str
    entity_type: EntityType
    location: Address
    deadline: Optional[datetime]
    posted_date: Optional[date]
    estimated_value: Optional[ValueRange]
    categories: List[str]
    set_asides: List[str]
    status: ContractStatus
    source_url: str


class ContractDetail(ContractListItem):
    source_id: str
    external_id: str
    description: Optional[str]
    department: Optional[str]
    contact: Optional[Dict[str, str]]
    dates: Dict[str, Any]
    contract_duration: Optional[str]
    naics_codes: List[str]
    contract_type: Optional[str]
    requirements: Dict[str, Any]
    is_set_aside: bool
    attachments: List[Dict[str, Any]]
    source_bid_number: Optional[str]
    created_at: datetime
    updated_at: datetime


class ContractSearchParams(BaseModel):
    q: Optional[str] = None
    status: Optional[ContractStatus] = ContractStatus.OPEN
    entity_type: Optional[EntityType] = None
    location: Optional[str] = None
    category: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    set_aside: Optional[str] = None
    deadline_after: Optional[datetime] = None
    deadline_before: Optional[datetime] = None
    sort: str = "deadline"
    order: str = "asc"
    limit: int = Field(default=20, le=100)
    offset: int = Field(default=0, ge=0)


# Match Schemas
class MatchResponse(BaseModel):
    id: str
    contract: ContractListItem
    score: float
    score_breakdown: Dict[str, float]
    match_reasons: List[str]
    missing_requirements: List[str]
    status: MatchStatus
    saved: bool
    created_at: datetime
    viewed_at: Optional[datetime]


class MatchStats(BaseModel):
    total_matches: int
    by_status: Dict[str, int]
    by_score_range: Dict[str, int]
    this_week: Dict[str, int]


# Document Schemas
class DocumentCreate(BaseModel):
    doc_type: DocType
    effective_date: Optional[date] = None
    expiration_date: Optional[date] = None
    metadata: Optional[Dict[str, Any]] = None


class DocumentResponse(BaseModel):
    id: str
    doc_type: DocType
    filename: str
    effective_date: Optional[date]
    expiration_date: Optional[date]
    is_current: bool
    verified: bool
    metadata: Optional[Dict[str, Any]]
    created_at: datetime


class ComplianceCheck(BaseModel):
    contract_id: str
    is_compliant: bool
    documents_required: List[Dict[str, Any]]
    ready_to_bid: bool


# Chat Schemas
class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    session_id: Optional[str] = None
    contract_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    sources: List[Dict[str, Any]]
    intent: str
    session_id: str


class SessionCreate(BaseModel):
    contract_id: Optional[str] = None
    context_type: str = "general"


class SessionResponse(BaseModel):
    session_id: str
    created_at: datetime


# Certification Schemas
class CertificationTypeResponse(BaseModel):
    code: str
    name: str
    issuer: str
    description: str
    ma_specific: bool
    application_url: Optional[str]


class EligibilityCheckRequest(BaseModel):
    ownership: Dict[str, Any]
    location: Address
    employee_count: Optional[int]
    annual_revenue: Optional[float]


class EligibilityResult(BaseModel):
    code: str
    name: str
    eligibility: str  # "likely_eligible", "possibly_eligible", "not_eligible"
    reasons: List[str]
    next_steps: Optional[List[str]]


class EligibilityCheckResponse(BaseModel):
    eligible_certifications: List[EligibilityResult]
    ineligible_certifications: List[EligibilityResult]


# Alert Schemas
class AlertResponse(BaseModel):
    id: str
    type: str
    subject: str
    body: str
    contract_id: Optional[str]
    status: str
    sent_at: Optional[datetime]
    read_at: Optional[datetime]


class AlertPreferences(BaseModel):
    email_notifications: bool = True
    sms_notifications: bool = False
    notification_frequency: str = "daily"
    alert_types: Dict[str, bool] = {}


# Saved Search Schemas
class SavedSearchCreate(BaseModel):
    name: str
    criteria: Dict[str, Any]
    notify_new_matches: bool = True
    notification_frequency: str = "daily"


class SavedSearchResponse(BaseModel):
    id: str
    name: str
    criteria: Dict[str, Any]
    notify_new_matches: bool
    notification_frequency: str
    last_run_at: Optional[datetime]
    last_match_count: int
    is_active: bool


# Pagination
class PaginatedResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[Any]
```

---

## Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |
| POST | /auth/register | Register user |
| POST | /auth/login | Login |
| GET | /businesses/me | Get user's business |
| POST | /businesses | Create business |
| PATCH | /businesses/{id} | Update business |
| POST | /businesses/{id}/certifications | Add certification |
| GET | /contracts | Search contracts |
| GET | /contracts/{id} | Get contract details |
| GET | /contracts/{id}/requirements | Get requirements |
| GET | /matches | Get matches |
| POST | /matches/{id}/view | Mark viewed |
| POST | /matches/{id}/save | Save match |
| POST | /matches/{id}/dismiss | Dismiss match |
| GET | /matches/stats | Get stats |
| GET | /documents | List documents |
| POST | /documents | Upload document |
| DELETE | /documents/{id} | Delete document |
| GET | /documents/compliance-check | Check compliance |
| POST | /chat | Ask question |
| POST | /chat/sessions | Create session |
| GET | /chat/sessions/{id}/history | Get history |
| GET | /certifications/types | List cert types |
| POST | /certifications/eligibility-check | Check eligibility |
| GET | /alerts | List alerts |
| POST | /alerts/{id}/read | Mark read |
| PUT | /alerts/preferences | Update preferences |
| GET | /saved-searches | List saved searches |
| POST | /saved-searches | Create saved search |
| DELETE | /saved-searches/{id} | Delete saved search |
| GET | /sources | List data sources |

---

## FastAPI Router Implementation

```python
# backend/app/api/__init__.py

from fastapi import APIRouter

from .auth import router as auth_router
from .businesses import router as businesses_router
from .contracts import router as contracts_router
from .matches import router as matches_router
from .documents import router as documents_router
from .chat import router as chat_router
from .certifications import router as certifications_router
from .alerts import router as alerts_router
from .saved_searches import router as saved_searches_router
from .sources import router as sources_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(businesses_router, prefix="/businesses", tags=["businesses"])
api_router.include_router(contracts_router, prefix="/contracts", tags=["contracts"])
api_router.include_router(matches_router, prefix="/matches", tags=["matches"])
api_router.include_router(documents_router, prefix="/documents", tags=["documents"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
api_router.include_router(certifications_router, prefix="/certifications", tags=["certifications"])
api_router.include_router(alerts_router, prefix="/alerts", tags=["alerts"])
api_router.include_router(saved_searches_router, prefix="/saved-searches", tags=["saved-searches"])
api_router.include_router(sources_router, prefix="/sources", tags=["sources"])
```

```python
# backend/app/api/contracts.py

from fastapi import APIRouter, Depends, Query, HTTPException
from typing import Optional, List

from app.auth import get_current_user
from app.schemas import (
    ContractListItem, ContractDetail, ContractSearchParams,
    PaginatedResponse
)
from app.services.contracts import ContractService

router = APIRouter()
contract_service = ContractService()


@router.get("/", response_model=PaginatedResponse)
async def search_contracts(
    q: Optional[str] = None,
    status: Optional[str] = Query("open"),
    entity_type: Optional[str] = None,
    location: Optional[str] = None,
    category: Optional[str] = None,
    min_value: Optional[float] = None,
    max_value: Optional[float] = None,
    set_aside: Optional[str] = None,
    deadline_after: Optional[str] = None,
    deadline_before: Optional[str] = None,
    sort: str = "deadline",
    order: str = "asc",
    limit: int = Query(20, le=100),
    offset: int = Query(0, ge=0),
    user = Depends(get_current_user)
):
    """Search and filter contracts."""
    params = ContractSearchParams(
        q=q, status=status, entity_type=entity_type,
        location=location, category=category,
        min_value=min_value, max_value=max_value,
        set_aside=set_aside, deadline_after=deadline_after,
        deadline_before=deadline_before, sort=sort, order=order,
        limit=limit, offset=offset
    )
    
    result = await contract_service.search(params)
    return result


@router.get("/{contract_id}", response_model=ContractDetail)
async def get_contract(
    contract_id: str,
    user = Depends(get_current_user)
):
    """Get contract details."""
    contract = await contract_service.get_by_id(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.get("/{contract_id}/requirements")
async def get_contract_requirements(
    contract_id: str,
    user = Depends(get_current_user)
):
    """Get detailed requirements with compliance check."""
    contract = await contract_service.get_by_id(contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    
    business = await get_user_business(user.id)
    requirements = await contract_service.get_requirements_with_compliance(
        contract_id, business
    )
    return requirements


@router.get("/{contract_id}/attachments/{attachment_id}/download")
async def download_attachment(
    contract_id: str,
    attachment_id: str,
    user = Depends(get_current_user)
):
    """Download contract attachment."""
    from fastapi.responses import StreamingResponse
    
    attachment = await contract_service.get_attachment(contract_id, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Stream from S3
    file_stream = await contract_service.get_attachment_stream(attachment)
    
    return StreamingResponse(
        file_stream,
        media_type=attachment.mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{attachment.filename}"'
        }
    )
```

---

## Error Handling

```python
# backend/app/errors.py

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError


class AppException(Exception):
    def __init__(self, error: str, message: str, status_code: int = 400, details: dict = None):
        self.error = error
        self.message = message
        self.status_code = status_code
        self.details = details


async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.error,
            "message": exc.message,
            "details": exc.details
        }
    )


async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": "validation_error",
            "message": "Validation failed",
            "details": exc.errors()
        }
    )


# Common exceptions
class NotFoundError(AppException):
    def __init__(self, resource: str):
        super().__init__(
            error="not_found",
            message=f"{resource} not found",
            status_code=404
        )


class UnauthorizedError(AppException):
    def __init__(self, message: str = "Invalid or expired authentication token"):
        super().__init__(
            error="unauthorized",
            message=message,
            status_code=401
        )


class ForbiddenError(AppException):
    def __init__(self, message: str = "You don't have permission to access this resource"):
        super().__init__(
            error="forbidden",
            message=message,
            status_code=403
        )


class RateLimitError(AppException):
    def __init__(self, retry_after: int = 60):
        super().__init__(
            error="rate_limited",
            message="Too many requests",
            status_code=429,
            details={"retry_after": retry_after}
        )
```

---

## Rate Limiting

```python
# backend/app/middleware/rate_limit.py

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
import time
from collections import defaultdict
import asyncio


class RateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)
        self.limits = {
            "default": (100, 60),      # 100 requests per minute
            "search": (30, 60),         # 30 per minute
            "chat": (20, 60),           # 20 per minute
            "upload": (10, 60),         # 10 per minute
        }
    
    def get_limit_type(self, path: str) -> str:
        if "/contracts" in path and "?" in path:
            return "search"
        if "/chat" in path:
            return "chat"
        if "/documents" in path and "POST" in path:
            return "upload"
        return "default"
    
    async def check_limit(self, user_id: str, limit_type: str) -> tuple[bool, dict]:
        max_requests, window = self.limits[limit_type]
        now = time.time()
        
        key = f"{user_id}:{limit_type}"
        
        # Clean old requests
        self.requests[key] = [
            t for t in self.requests[key]
            if t > now - window
        ]
        
        if len(self.requests[key]) >= max_requests:
            reset_time = int(self.requests[key][0] + window)
            return False, {
                "limit": max_requests,
                "remaining": 0,
                "reset": reset_time
            }
        
        self.requests[key].append(now)
        
        return True, {
            "limit": max_requests,
            "remaining": max_requests - len(self.requests[key]),
            "reset": int(now + window)
        }


rate_limiter = RateLimiter()


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for unauthenticated requests
        user_id = request.state.user_id if hasattr(request.state, "user_id") else None
        
        if user_id:
            limit_type = rate_limiter.get_limit_type(request.url.path)
            allowed, headers = await rate_limiter.check_limit(user_id, limit_type)
            
            if not allowed:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "rate_limited",
                        "message": "Too many requests",
                        "retry_after": headers["reset"] - int(time.time())
                    },
                    headers={
                        "X-RateLimit-Limit": str(headers["limit"]),
                        "X-RateLimit-Remaining": str(headers["remaining"]),
                        "X-RateLimit-Reset": str(headers["reset"]),
                    }
                )
        
        response = await call_next(request)
        
        # Add rate limit headers to response
        if user_id:
            response.headers["X-RateLimit-Limit"] = str(headers["limit"])
            response.headers["X-RateLimit-Remaining"] = str(headers["remaining"])
            response.headers["X-RateLimit-Reset"] = str(headers["reset"])
        
        return response
```

---

## OpenAPI Documentation

FastAPI automatically generates OpenAPI documentation. Access at:
- Swagger UI: `/docs`
- ReDoc: `/redoc`
- OpenAPI JSON: `/openapi.json`

Custom configuration:

```python
# backend/app/main.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.errors import app_exception_handler, AppException

app = FastAPI(
    title="BidScout API",
    description="AI-powered government contract discovery for small businesses",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_tags=[
        {"name": "auth", "description": "Authentication endpoints"},
        {"name": "businesses", "description": "Business profile management"},
        {"name": "contracts", "description": "Contract search and details"},
        {"name": "matches", "description": "Contract-business matching"},
        {"name": "documents", "description": "Compliance document management"},
        {"name": "chat", "description": "RAG-powered Q&A"},
        {"name": "certifications", "description": "Certification information"},
        {"name": "alerts", "description": "Notification management"},
        {"name": "saved-searches", "description": "Saved search criteria"},
        {"name": "sources", "description": "Data source information"},
    ]
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://bidscout.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(AppException, app_exception_handler)

# Include routes
app.include_router(api_router, prefix="/v1")


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "1.0.0"
    }
```
