# Frontend Specification

## Overview

BidScout's frontend is built with Next.js 14+ (App Router), Tailwind CSS, and React. It provides a clean, accessible interface for small business owners to discover contracts, manage compliance, and get AI-powered assistance.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 14+ | React framework with App Router |
| TypeScript | Type safety |
| Tailwind CSS | Styling |
| shadcn/ui | Component library |
| React Query | Data fetching and caching |
| Zustand | Client state management |
| React Hook Form | Form handling |
| Zod | Validation |

---

## Project Structure

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── register/
│   │   │   └── page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Dashboard home
│   │   ├── contracts/
│   │   │   ├── page.tsx                # Contract search
│   │   │   └── [id]/
│   │   │       └── page.tsx            # Contract detail
│   │   ├── matches/
│   │   │   └── page.tsx                # Matched contracts
│   │   ├── documents/
│   │   │   └── page.tsx                # Document vault
│   │   ├── certifications/
│   │   │   └── page.tsx                # Certification guide
│   │   ├── profile/
│   │   │   └── page.tsx                # Business profile
│   │   └── settings/
│   │       └── page.tsx                # Settings
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                             # shadcn components
│   ├── contracts/
│   │   ├── ContractCard.tsx
│   │   ├── ContractList.tsx
│   │   ├── ContractDetail.tsx
│   │   ├── ContractFilters.tsx
│   │   └── RequirementsList.tsx
│   ├── matches/
│   │   ├── MatchCard.tsx
│   │   ├── MatchList.tsx
│   │   └── ScoreBreakdown.tsx
│   ├── documents/
│   │   ├── DocumentUpload.tsx
│   │   ├── DocumentList.tsx
│   │   └── ComplianceStatus.tsx
│   ├── chat/
│   │   ├── ChatWindow.tsx
│   │   ├── ChatMessage.tsx
│   │   └── ChatInput.tsx
│   ├── profile/
│   │   ├── BusinessForm.tsx
│   │   ├── CertificationForm.tsx
│   │   └── ServiceSelector.tsx
│   └── layout/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       ├── MobileNav.tsx
│       └── Footer.tsx
├── lib/
│   ├── api.ts                          # API client
│   ├── auth.ts                         # Auth helpers
│   ├── utils.ts                        # Utilities
│   └── constants.ts                    # Constants
├── hooks/
│   ├── useContracts.ts
│   ├── useMatches.ts
│   ├── useDocuments.ts
│   ├── useChat.ts
│   └── useBusiness.ts
├── stores/
│   ├── authStore.ts
│   └── uiStore.ts
├── types/
│   └── index.ts                        # TypeScript types
└── public/
    └── ...
```

---

## Pages

### 1. Dashboard (Home)

**Route:** `/`

**Purpose:** Quick overview of opportunities and action items

**Components:**
- Stats cards (new matches, upcoming deadlines, documents expiring)
- Recent matches list (top 5)
- Quick actions (search contracts, upload document)
- Upcoming deadlines calendar widget

```tsx
// app/(dashboard)/page.tsx

import { MatchStats } from '@/components/matches/MatchStats'
import { RecentMatches } from '@/components/matches/RecentMatches'
import { UpcomingDeadlines } from '@/components/contracts/UpcomingDeadlines'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { ExpiringDocuments } from '@/components/documents/ExpiringDocuments'

export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      
      {/* Stats Row */}
      <MatchStats />
      
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-6">
          <RecentMatches limit={5} />
          <UpcomingDeadlines limit={5} />
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          <QuickActions />
          <ExpiringDocuments />
        </div>
      </div>
    </div>
  )
}
```

### 2. Contract Search

**Route:** `/contracts`

**Purpose:** Search and filter all available contracts

**Components:**
- Search input with autocomplete
- Filter panel (entity type, location, value range, etc.)
- Results list with pagination
- Sort options

```tsx
// app/(dashboard)/contracts/page.tsx

'use client'

import { useState } from 'react'
import { useContracts } from '@/hooks/useContracts'
import { ContractFilters } from '@/components/contracts/ContractFilters'
import { ContractList } from '@/components/contracts/ContractList'
import { SearchInput } from '@/components/ui/SearchInput'
import { Pagination } from '@/components/ui/Pagination'

export default function ContractsPage() {
  const [filters, setFilters] = useState({})
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  
  const { data, isLoading } = useContracts({
    q: search,
    ...filters,
    offset: (page - 1) * 20
  })
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Find Contracts</h1>
      </div>
      
      {/* Search */}
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Search contracts..."
      />
      
      <div className="flex gap-6">
        {/* Filters Sidebar */}
        <aside className="w-64 flex-shrink-0">
          <ContractFilters
            filters={filters}
            onChange={setFilters}
          />
        </aside>
        
        {/* Results */}
        <main className="flex-1">
          <ContractList
            contracts={data?.items || []}
            isLoading={isLoading}
          />
          
          <Pagination
            total={data?.total || 0}
            page={page}
            pageSize={20}
            onChange={setPage}
          />
        </main>
      </div>
    </div>
  )
}
```

### 3. Contract Detail

**Route:** `/contracts/[id]`

**Purpose:** View contract details, requirements, and ask questions

**Components:**
- Contract header (title, entity, deadline countdown)
- Description section
- Requirements checklist (with user compliance status)
- Attachments list
- Chat interface for questions
- Actions (save, mark as applied)

```tsx
// app/(dashboard)/contracts/[id]/page.tsx

import { ContractHeader } from '@/components/contracts/ContractHeader'
import { ContractDescription } from '@/components/contracts/ContractDescription'
import { RequirementsList } from '@/components/contracts/RequirementsList'
import { AttachmentsList } from '@/components/contracts/AttachmentsList'
import { ContractChat } from '@/components/chat/ContractChat'
import { ContractActions } from '@/components/contracts/ContractActions'

interface Props {
  params: { id: string }
}

export default async function ContractDetailPage({ params }: Props) {
  const contract = await getContract(params.id)
  
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <ContractHeader contract={contract} />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <ContractDescription description={contract.description} />
          <RequirementsList 
            contractId={contract.id}
            requirements={contract.requirements}
          />
          <AttachmentsList attachments={contract.attachments} />
        </div>
        
        <aside className="space-y-6">
          <ContractActions contract={contract} />
          <ContractChat contractId={contract.id} />
        </aside>
      </div>
    </div>
  )
}
```

### 4. Matches

**Route:** `/matches`

**Purpose:** View and manage matched contracts

**Components:**
- Match stats (new, saved, applied)
- Filter tabs (All, New, Saved, Applied)
- Match cards with scores and reasons
- Bulk actions

```tsx
// app/(dashboard)/matches/page.tsx

'use client'

import { useState } from 'react'
import { useMatches } from '@/hooks/useMatches'
import { MatchList } from '@/components/matches/MatchList'
import { MatchFilters } from '@/components/matches/MatchFilters'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'

export default function MatchesPage() {
  const [status, setStatus] = useState<string | null>(null)
  const { data, isLoading } = useMatches({ status })
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Matches</h1>
        <div className="text-sm text-gray-500">
          {data?.new_count || 0} new opportunities
        </div>
      </div>
      
      <Tabs value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? null : v)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="new">New</TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
          <TabsTrigger value="applied">Applied</TabsTrigger>
        </TabsList>
      </Tabs>
      
      <MatchList
        matches={data?.items || []}
        isLoading={isLoading}
      />
    </div>
  )
}
```

### 5. Document Vault

**Route:** `/documents`

**Purpose:** Manage compliance documents

**Components:**
- Document list by type
- Upload form
- Expiration alerts
- Compliance status per document type

```tsx
// app/(dashboard)/documents/page.tsx

'use client'

import { useDocuments } from '@/hooks/useDocuments'
import { DocumentList } from '@/components/documents/DocumentList'
import { DocumentUpload } from '@/components/documents/DocumentUpload'
import { ComplianceOverview } from '@/components/documents/ComplianceOverview'

export default function DocumentsPage() {
  const { data: documents, isLoading, refetch } = useDocuments()
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Document Vault</h1>
        <DocumentUpload onSuccess={refetch} />
      </div>
      
      {/* Compliance Overview */}
      <ComplianceOverview documents={documents || []} />
      
      {/* Document List */}
      <DocumentList
        documents={documents || []}
        isLoading={isLoading}
        onDelete={refetch}
      />
    </div>
  )
}
```

### 6. Business Profile

**Route:** `/profile`

**Purpose:** Manage business profile for matching

**Components:**
- Business info form
- Service type selector
- Certification list
- Contract preferences
- Ownership demographics (for certification eligibility)

---

## Key Components

### MatchCard

```tsx
// components/matches/MatchCard.tsx

import { Match } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ScoreGauge } from './ScoreGauge'
import { formatDistanceToNow } from 'date-fns'

interface MatchCardProps {
  match: Match
  onView: () => void
  onSave: () => void
  onDismiss: () => void
}

export function MatchCard({ match, onView, onSave, onDismiss }: MatchCardProps) {
  const { contract, score, match_reasons, missing_requirements, status } = match
  
  return (
    <div className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            {status === 'new' && (
              <Badge variant="blue">New</Badge>
            )}
            <span className="text-sm text-gray-500">
              {contract.entity_name}
            </span>
          </div>
          
          {/* Title */}
          <h3 className="font-semibold text-lg mb-2">
            <a href={`/contracts/${contract.id}`} className="hover:text-blue-600">
              {contract.title}
            </a>
          </h3>
          
          {/* Match Reasons */}
          <ul className="text-sm text-gray-600 space-y-1 mb-3">
            {match_reasons.slice(0, 3).map((reason, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="text-green-500">✓</span>
                {reason}
              </li>
            ))}
          </ul>
          
          {/* Missing Requirements */}
          {missing_requirements.length > 0 && (
            <div className="text-sm text-amber-600 mb-3">
              <span className="font-medium">Note:</span>{' '}
              {missing_requirements[0]}
            </div>
          )}
          
          {/* Deadline */}
          {contract.deadline && (
            <div className="text-sm text-gray-500">
              Deadline: {formatDistanceToNow(new Date(contract.deadline), { addSuffix: true })}
            </div>
          )}
        </div>
        
        {/* Score */}
        <div className="ml-4">
          <ScoreGauge score={score} size="sm" />
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2 mt-4 pt-4 border-t">
        <Button variant="primary" onClick={onView}>
          View Details
        </Button>
        <Button variant="outline" onClick={onSave}>
          {match.saved ? 'Saved' : 'Save'}
        </Button>
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}
```

### ChatWindow

```tsx
// components/chat/ChatWindow.tsx

'use client'

import { useState, useRef, useEffect } from 'react'
import { useChat } from '@/hooks/useChat'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { Loader2 } from 'lucide-react'

interface ChatWindowProps {
  contractId?: string
  initialMessage?: string
}

export function ChatWindow({ contractId, initialMessage }: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  
  const { messages, isLoading, sendMessage, createSession } = useChat({
    sessionId,
    contractId
  })
  
  useEffect(() => {
    // Create session on mount
    createSession().then(setSessionId)
  }, [])
  
  useEffect(() => {
    // Scroll to bottom on new messages
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])
  
  const handleSend = async (content: string) => {
    await sendMessage(content)
  }
  
  return (
    <div className="flex flex-col h-[400px] border rounded-lg">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Welcome message */}
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <p className="font-medium mb-2">Ask me anything about this contract</p>
            <p className="text-sm">
              I can help with requirements, deadlines, certifications, and more.
            </p>
          </div>
        )}
        
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <div className="border-t p-4">
        <ChatInput
          onSend={handleSend}
          disabled={isLoading || !sessionId}
          placeholder="Ask a question..."
        />
      </div>
    </div>
  )
}
```

### RequirementsList

```tsx
// components/contracts/RequirementsList.tsx

'use client'

import { useRequirements } from '@/hooks/useRequirements'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

interface RequirementsListProps {
  contractId: string
}

export function RequirementsList({ contractId }: RequirementsListProps) {
  const { data, isLoading } = useRequirements(contractId)
  
  if (isLoading) return <div>Loading requirements...</div>
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'missing':
        return <XCircle className="w-5 h-5 text-red-500" />
      case 'insufficient':
        return <AlertCircle className="w-5 h-5 text-amber-500" />
      default:
        return null
    }
  }
  
  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-lg font-semibold mb-4">Requirements</h2>
      
      {/* Compliance Summary */}
      <div className={`p-4 rounded-lg mb-6 ${
        data.is_compliant 
          ? 'bg-green-50 text-green-800'
          : 'bg-amber-50 text-amber-800'
      }`}>
        {data.is_compliant ? (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">You meet all requirements</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="font-medium">Some requirements need attention</span>
          </div>
        )}
      </div>
      
      {/* Requirements List */}
      <ul className="space-y-4">
        {data.documents_required.map((req, i) => (
          <li key={i} className="flex items-start gap-3">
            {getStatusIcon(req.status)}
            <div className="flex-1">
              <p className="font-medium">{req.description}</p>
              {req.issue && (
                <p className="text-sm text-amber-600 mt-1">{req.issue}</p>
              )}
              {req.status === 'complete' && req.document_id && (
                <p className="text-sm text-green-600 mt-1">
                  ✓ Document on file
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

---

## API Client

```typescript
// lib/api.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/v1'

class ApiClient {
  private token: string | null = null
  
  setToken(token: string) {
    this.token = token
  }
  
  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new ApiError(error.message, response.status, error.details)
    }
    
    return response.json()
  }
  
  // Contracts
  async getContracts(params: ContractSearchParams) {
    const query = new URLSearchParams(params as any).toString()
    return this.fetch<PaginatedResponse<Contract>>(`/contracts?${query}`)
  }
  
  async getContract(id: string) {
    return this.fetch<ContractDetail>(`/contracts/${id}`)
  }
  
  async getContractRequirements(id: string) {
    return this.fetch<ComplianceCheck>(`/contracts/${id}/requirements`)
  }
  
  // Matches
  async getMatches(params: MatchParams) {
    const query = new URLSearchParams(params as any).toString()
    return this.fetch<MatchesResponse>(`/matches?${query}`)
  }
  
  async markMatchViewed(id: string) {
    return this.fetch(`/matches/${id}/view`, { method: 'POST' })
  }
  
  async saveMatch(id: string) {
    return this.fetch(`/matches/${id}/save`, { method: 'POST' })
  }
  
  async dismissMatch(id: string, reason?: string) {
    return this.fetch(`/matches/${id}/dismiss`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }
  
  // Documents
  async getDocuments() {
    return this.fetch<Document[]>('/documents')
  }
  
  async uploadDocument(file: File, data: DocumentCreate) {
    const formData = new FormData()
    formData.append('file', file)
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, value)
    })
    
    return fetch(`${API_BASE}/documents`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    }).then(r => r.json())
  }
  
  // Chat
  async createChatSession(contractId?: string) {
    return this.fetch<{ session_id: string }>('/chat/sessions', {
      method: 'POST',
      body: JSON.stringify({ contract_id: contractId }),
    })
  }
  
  async sendChatMessage(query: string, sessionId: string, contractId?: string) {
    return this.fetch<ChatResponse>('/chat', {
      method: 'POST',
      body: JSON.stringify({ query, session_id: sessionId, contract_id: contractId }),
    })
  }
  
  // Business
  async getBusiness() {
    return this.fetch<Business>('/businesses/me')
  }
  
  async updateBusiness(data: BusinessUpdate) {
    return this.fetch<Business>('/businesses/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  }
  
  // Certifications
  async checkEligibility(data: EligibilityCheckRequest) {
    return this.fetch<EligibilityCheckResponse>('/certifications/eligibility-check', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }
}

export const api = new ApiClient()


class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message)
  }
}
```

---

## React Query Hooks

```typescript
// hooks/useContracts.ts

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useContracts(params: ContractSearchParams) {
  return useQuery({
    queryKey: ['contracts', params],
    queryFn: () => api.getContracts(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useContract(id: string) {
  return useQuery({
    queryKey: ['contract', id],
    queryFn: () => api.getContract(id),
    staleTime: 1000 * 60 * 10, // 10 minutes
  })
}

export function useContractRequirements(id: string) {
  return useQuery({
    queryKey: ['contract-requirements', id],
    queryFn: () => api.getContractRequirements(id),
  })
}
```

```typescript
// hooks/useMatches.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useMatches(params: MatchParams = {}) {
  return useQuery({
    queryKey: ['matches', params],
    queryFn: () => api.getMatches(params),
    staleTime: 1000 * 60 * 2, // 2 minutes
  })
}

export function useMatchActions() {
  const queryClient = useQueryClient()
  
  const invalidateMatches = () => {
    queryClient.invalidateQueries({ queryKey: ['matches'] })
  }
  
  const markViewed = useMutation({
    mutationFn: (id: string) => api.markMatchViewed(id),
    onSuccess: invalidateMatches,
  })
  
  const save = useMutation({
    mutationFn: (id: string) => api.saveMatch(id),
    onSuccess: invalidateMatches,
  })
  
  const dismiss = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.dismissMatch(id, reason),
    onSuccess: invalidateMatches,
  })
  
  return { markViewed, save, dismiss }
}
```

```typescript
// hooks/useChat.ts

import { useState, useCallback } from 'react'
import { api } from '@/lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface UseChatOptions {
  sessionId: string | null
  contractId?: string
}

export function useChat({ sessionId, contractId }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const createSession = useCallback(async () => {
    const { session_id } = await api.createChatSession(contractId)
    return session_id
  }, [contractId])
  
  const sendMessage = useCallback(async (content: string) => {
    if (!sessionId) return
    
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content }])
    setIsLoading(true)
    
    try {
      const response = await api.sendChatMessage(content, sessionId, contractId)
      setMessages(prev => [...prev, { role: 'assistant', content: response.answer }])
    } catch (error) {
      // Handle error
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.'
      }])
    } finally {
      setIsLoading(false)
    }
  }, [sessionId, contractId])
  
  return {
    messages,
    isLoading,
    sendMessage,
    createSession,
  }
}
```

---

## Styling

Using Tailwind CSS with custom theme:

```javascript
// tailwind.config.js

module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
        // Add more custom colors
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
```

---

## Responsive Design

All pages are mobile-responsive:
- Sidebar collapses to hamburger menu on mobile
- Cards stack vertically
- Filters move to modal/drawer on mobile
- Touch-friendly tap targets

---

## Accessibility

- Semantic HTML
- ARIA labels where needed
- Keyboard navigation support
- Focus indicators
- Color contrast compliance
- Screen reader compatibility
