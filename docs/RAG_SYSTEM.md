# RAG System Implementation

## Overview

BidScout uses Retrieval-Augmented Generation (RAG) to power its Q&A interface. Users can ask natural language questions about contracts, requirements, certifications, and compliance - and get accurate answers grounded in actual source documents.

## Use Cases

1. **Contract Questions**: "What insurance do I need for this bid?"
2. **Certification Guidance**: "Am I eligible for MBE certification?"
3. **Compliance Help**: "What documents are required for City of Boston contracts?"
4. **Comparison**: "How does this contract compare to the one from Cambridge?"
5. **Deadline Tracking**: "When is the pre-bid meeting for contract X?"

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER QUESTION                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     QUERY PROCESSOR                             │
│  - Intent classification                                        │
│  - Entity extraction (contract IDs, cert types)                 │
│  - Query expansion                                              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONTEXT RETRIEVAL                            │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Vector    │  │   Keyword   │  │  Metadata   │             │
│  │   Search    │  │   Search    │  │   Filter    │             │
│  │  (pgvector) │  │    (FTS)    │  │             │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                      │
│                          ▼                                      │
│                   HYBRID RERANKER                               │
│              (combine and dedupe results)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CONTEXT BUILDER                              │
│  - Select top chunks                                            │
│  - Add contract metadata                                        │
│  - Include business context                                     │
│  - Build prompt                                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLAUDE API                                 │
│  - Generate response                                            │
│  - Cite sources                                                 │
│  - Handle follow-ups                                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     RESPONSE + CITATIONS                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Document Processing Pipeline

### 1. Document Ingestion

```python
# backend/services/rag/ingestion.py

from typing import List, Dict, Any
import hashlib
from datetime import datetime

from app.models import Contract, Attachment, Embedding
from app.db import get_db
from .chunker import chunk_document
from .embedder import generate_embeddings


class DocumentIngester:
    """Processes documents for RAG retrieval."""
    
    def __init__(self):
        self.db = get_db()
    
    async def ingest_contract(self, contract: Contract):
        """
        Process a contract and its attachments for RAG.
        """
        # 1. Process main contract content
        contract_text = self.build_contract_text(contract)
        chunks = chunk_document(
            text=contract_text,
            source_type='contract',
            source_id=str(contract.id),
            metadata={
                'entity_name': contract.entity_name,
                'entity_type': contract.entity_type,
                'categories': contract.categories,
                'location': contract.location_city
            }
        )
        
        # 2. Generate embeddings
        embeddings = await generate_embeddings([c['content'] for c in chunks])
        
        # 3. Store in vector DB
        for chunk, embedding in zip(chunks, embeddings):
            await self.store_embedding(
                source_type='contract',
                source_id=str(contract.id),
                chunk_index=chunk['index'],
                content=chunk['content'],
                embedding=embedding,
                metadata=chunk['metadata']
            )
        
        # 4. Process attachments
        attachments = await self.db.attachments.find({
            'contract_id': contract.id,
            'extraction_status': 'completed'
        }).to_list()
        
        for attachment in attachments:
            await self.ingest_attachment(attachment, contract)
        
        # Mark contract as processed
        await self.db.contracts.update_one(
            {'_id': contract.id},
            {'$set': {'embedding_generated': True}}
        )
    
    async def ingest_attachment(self, attachment: Attachment, contract: Contract):
        """Process a PDF attachment."""
        if not attachment.content_text:
            return
        
        chunks = chunk_document(
            text=attachment.content_text,
            source_type='attachment',
            source_id=str(attachment.id),
            metadata={
                'contract_id': str(contract.id),
                'filename': attachment.filename,
                'attachment_type': attachment.attachment_type,
                'entity_name': contract.entity_name
            }
        )
        
        embeddings = await generate_embeddings([c['content'] for c in chunks])
        
        for chunk, embedding in zip(chunks, embeddings):
            await self.store_embedding(
                source_type='attachment',
                source_id=str(attachment.id),
                chunk_index=chunk['index'],
                content=chunk['content'],
                embedding=embedding,
                metadata=chunk['metadata']
            )
    
    def build_contract_text(self, contract: Contract) -> str:
        """Build searchable text from contract fields."""
        parts = [
            f"Title: {contract.title}",
            f"Entity: {contract.entity_name}",
            f"Type: {contract.entity_type}",
            f"Location: {contract.location_city}, {contract.location_state}",
        ]
        
        if contract.description:
            parts.append(f"Description: {contract.description}")
        
        if contract.deadline:
            parts.append(f"Deadline: {contract.deadline.strftime('%B %d, %Y at %I:%M %p')}")
        
        if contract.estimated_value_max:
            parts.append(f"Estimated Value: ${contract.estimated_value_max:,.2f}")
        
        if contract.categories:
            parts.append(f"Categories: {', '.join(contract.categories)}")
        
        if contract.set_asides:
            parts.append(f"Set-asides: {', '.join(contract.set_asides)}")
        
        if contract.required_certifications:
            parts.append(f"Required Certifications: {', '.join(contract.required_certifications)}")
        
        return "\n".join(parts)
    
    async def store_embedding(
        self,
        source_type: str,
        source_id: str,
        chunk_index: int,
        content: str,
        embedding: List[float],
        metadata: Dict[str, Any]
    ):
        """Store embedding in pgvector."""
        await self.db.execute("""
            INSERT INTO embeddings (source_type, source_id, chunk_index, content, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (source_type, source_id, chunk_index) 
            DO UPDATE SET embedding = $5, metadata = $6
        """, source_type, source_id, chunk_index, content, embedding, metadata)
```

### 2. Document Chunking

```python
# backend/services/rag/chunker.py

from typing import List, Dict, Any
import re


def chunk_document(
    text: str,
    source_type: str,
    source_id: str,
    metadata: Dict[str, Any],
    chunk_size: int = 1000,
    chunk_overlap: int = 200
) -> List[Dict[str, Any]]:
    """
    Split document into overlapping chunks for embedding.
    
    Uses semantic boundaries (paragraphs, sections) when possible.
    """
    chunks = []
    
    # Try to split on semantic boundaries first
    sections = split_on_sections(text)
    
    chunk_index = 0
    for section in sections:
        if len(section) <= chunk_size:
            chunks.append({
                'index': chunk_index,
                'content': section.strip(),
                'metadata': {**metadata, 'source_type': source_type, 'source_id': source_id}
            })
            chunk_index += 1
        else:
            # Split large sections with overlap
            sub_chunks = split_with_overlap(section, chunk_size, chunk_overlap)
            for sub_chunk in sub_chunks:
                chunks.append({
                    'index': chunk_index,
                    'content': sub_chunk.strip(),
                    'metadata': {**metadata, 'source_type': source_type, 'source_id': source_id}
                })
                chunk_index += 1
    
    return chunks


def split_on_sections(text: str) -> List[str]:
    """Split text on section headers and paragraph breaks."""
    # Common section patterns in government documents
    section_patterns = [
        r'\n\s*(?:SECTION|ARTICLE|PART)\s+\d+',
        r'\n\s*\d+\.\s+[A-Z]',
        r'\n\s*[A-Z][A-Z\s]+:\s*\n',
        r'\n\n\n+',
    ]
    
    combined_pattern = '|'.join(f'({p})' for p in section_patterns)
    
    parts = re.split(combined_pattern, text)
    
    # Recombine keeping the delimiters
    sections = []
    current = ""
    
    for part in parts:
        if part is None:
            continue
        if re.match(combined_pattern, part):
            if current:
                sections.append(current)
            current = part
        else:
            current += part
    
    if current:
        sections.append(current)
    
    return [s for s in sections if s.strip()]


def split_with_overlap(text: str, chunk_size: int, overlap: int) -> List[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        
        # Try to break at sentence boundary
        if end < len(text):
            # Look for sentence end near chunk boundary
            sentence_end = text.rfind('. ', start + chunk_size - 100, end + 100)
            if sentence_end > start:
                end = sentence_end + 1
        
        chunks.append(text[start:end])
        start = end - overlap
    
    return chunks
```

### 3. Embedding Generation

```python
# backend/services/rag/embedder.py

from typing import List
import anthropic
import asyncio


# Using Anthropic's embedding model (or OpenAI's)
client = anthropic.AsyncAnthropic()


async def generate_embeddings(texts: List[str], batch_size: int = 20) -> List[List[float]]:
    """
    Generate embeddings for a list of texts.
    
    Uses batching to handle rate limits.
    """
    all_embeddings = []
    
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        
        # Using Claude's embedding endpoint (hypothetical - adjust for actual API)
        # Or use OpenAI's text-embedding-3-small
        embeddings = await generate_batch_embeddings(batch)
        all_embeddings.extend(embeddings)
        
        # Rate limiting
        if i + batch_size < len(texts):
            await asyncio.sleep(0.5)
    
    return all_embeddings


async def generate_batch_embeddings(texts: List[str]) -> List[List[float]]:
    """Generate embeddings for a batch of texts."""
    # Option 1: Use OpenAI embeddings
    import openai
    
    response = await openai.embeddings.create(
        model="text-embedding-3-small",
        input=texts
    )
    
    return [item.embedding for item in response.data]
```

---

## Query Processing

### 1. Intent Classification

```python
# backend/services/rag/query_processor.py

from typing import Dict, Any, Optional, List
from enum import Enum
import re


class QueryIntent(Enum):
    CONTRACT_QUESTION = "contract_question"      # About specific contract
    CERTIFICATION_HELP = "certification_help"    # Certification eligibility
    COMPLIANCE_HELP = "compliance_help"          # Document requirements
    COMPARISON = "comparison"                    # Compare contracts
    GENERAL_INFO = "general_info"               # General procurement info
    DEADLINE_CHECK = "deadline_check"           # Deadline questions


class QueryProcessor:
    """Processes user queries to extract intent and entities."""
    
    def process(self, query: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Process a user query.
        
        Args:
            query: User's question
            context: Optional context (current contract, business info)
        
        Returns:
            Processed query with intent, entities, and search parameters
        """
        result = {
            'original_query': query,
            'intent': self.classify_intent(query),
            'entities': self.extract_entities(query),
            'search_query': self.build_search_query(query),
            'filters': self.extract_filters(query, context)
        }
        
        return result
    
    def classify_intent(self, query: str) -> QueryIntent:
        """Classify the intent of the query."""
        query_lower = query.lower()
        
        # Certification questions
        cert_keywords = ['certification', 'certified', 'mbe', 'wbe', 'dbe', 'eligible', 'qualify']
        if any(kw in query_lower for kw in cert_keywords):
            return QueryIntent.CERTIFICATION_HELP
        
        # Deadline questions
        deadline_keywords = ['deadline', 'due', 'when', 'date', 'pre-bid', 'submit by']
        if any(kw in query_lower for kw in deadline_keywords):
            return QueryIntent.DEADLINE_CHECK
        
        # Compliance/document questions
        compliance_keywords = ['require', 'need', 'document', 'insurance', 'bond', 'w-9', 'coi']
        if any(kw in query_lower for kw in compliance_keywords):
            return QueryIntent.COMPLIANCE_HELP
        
        # Comparison questions
        if 'compare' in query_lower or 'difference' in query_lower or 'vs' in query_lower:
            return QueryIntent.COMPARISON
        
        # Default to contract question
        return QueryIntent.CONTRACT_QUESTION
    
    def extract_entities(self, query: str) -> Dict[str, Any]:
        """Extract named entities from query."""
        entities = {
            'contract_ids': [],
            'certifications': [],
            'locations': [],
            'amounts': []
        }
        
        # Contract ID patterns (e.g., EV00016920, BD-25-1109)
        contract_patterns = [
            r'EV\d{8}',
            r'BD-\d{2}-\d{4}-[A-Z]+-[A-Z]+-\d+',
            r'contract\s+#?\s*(\w+-?\d+)'
        ]
        for pattern in contract_patterns:
            matches = re.findall(pattern, query, re.IGNORECASE)
            entities['contract_ids'].extend(matches)
        
        # Certification types
        cert_patterns = ['MBE', 'WBE', 'DBE', 'VBE', 'SDVOBE', 'SBE', 'LGBTBE']
        for cert in cert_patterns:
            if cert.lower() in query.lower():
                entities['certifications'].append(cert)
        
        # Money amounts
        amount_pattern = r'\$[\d,]+(?:\.\d{2})?|\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:dollars?|k|K|million|M)'
        amounts = re.findall(amount_pattern, query)
        entities['amounts'] = amounts
        
        # Massachusetts cities
        ma_cities = ['boston', 'cambridge', 'worcester', 'springfield', 'lowell', 'quincy']
        for city in ma_cities:
            if city in query.lower():
                entities['locations'].append(city.title())
        
        return entities
    
    def build_search_query(self, query: str) -> str:
        """Build optimized search query."""
        # Remove common question words
        stop_words = [
            'what', 'when', 'where', 'how', 'why', 'who', 'which',
            'is', 'are', 'do', 'does', 'can', 'could', 'would', 'should',
            'the', 'a', 'an', 'this', 'that', 'for', 'of', 'to', 'in'
        ]
        
        words = query.lower().split()
        filtered = [w for w in words if w not in stop_words and len(w) > 2]
        
        return ' '.join(filtered)
    
    def extract_filters(self, query: str, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """Extract metadata filters for retrieval."""
        filters = {}
        
        # If context has current contract, prioritize it
        if context and 'contract_id' in context:
            filters['contract_id'] = context['contract_id']
        
        # Location filter
        entities = self.extract_entities(query)
        if entities['locations']:
            filters['location'] = entities['locations'][0]
        
        return filters
```

---

## Retrieval

### Hybrid Retrieval

```python
# backend/services/rag/retriever.py

from typing import List, Dict, Any, Optional
import asyncio

from app.db import get_db
from .embedder import generate_embeddings


class HybridRetriever:
    """
    Combines vector search with keyword search for better retrieval.
    """
    
    def __init__(self):
        self.db = get_db()
    
    async def retrieve(
        self,
        query: str,
        filters: Dict[str, Any] = None,
        top_k: int = 10,
        vector_weight: float = 0.7,
        keyword_weight: float = 0.3
    ) -> List[Dict[str, Any]]:
        """
        Retrieve relevant chunks using hybrid search.
        """
        # Run searches in parallel
        vector_results, keyword_results = await asyncio.gather(
            self.vector_search(query, filters, top_k * 2),
            self.keyword_search(query, filters, top_k * 2)
        )
        
        # Combine and rerank
        combined = self.combine_results(
            vector_results, keyword_results,
            vector_weight, keyword_weight
        )
        
        return combined[:top_k]
    
    async def vector_search(
        self,
        query: str,
        filters: Dict[str, Any] = None,
        top_k: int = 20
    ) -> List[Dict[str, Any]]:
        """Semantic search using embeddings."""
        # Generate query embedding
        query_embedding = (await generate_embeddings([query]))[0]
        
        # Build filter clause
        filter_clause = ""
        params = [query_embedding, top_k]
        
        if filters:
            filter_conditions = []
            param_idx = 3
            
            if 'contract_id' in filters:
                filter_conditions.append(f"metadata->>'contract_id' = ${param_idx}")
                params.append(filters['contract_id'])
                param_idx += 1
            
            if 'location' in filters:
                filter_conditions.append(f"metadata->>'location' ILIKE ${param_idx}")
                params.append(f"%{filters['location']}%")
                param_idx += 1
            
            if filter_conditions:
                filter_clause = "WHERE " + " AND ".join(filter_conditions)
        
        # Vector similarity search
        results = await self.db.fetch(f"""
            SELECT 
                id,
                source_type,
                source_id,
                chunk_index,
                content,
                metadata,
                1 - (embedding <=> $1) as similarity
            FROM embeddings
            {filter_clause}
            ORDER BY embedding <=> $1
            LIMIT $2
        """, *params)
        
        return [dict(r) for r in results]
    
    async def keyword_search(
        self,
        query: str,
        filters: Dict[str, Any] = None,
        top_k: int = 20
    ) -> List[Dict[str, Any]]:
        """Full-text search using PostgreSQL FTS."""
        # Build filter clause
        filter_clause = ""
        params = [query, top_k]
        
        if filters:
            filter_conditions = []
            param_idx = 3
            
            if 'contract_id' in filters:
                filter_conditions.append(f"metadata->>'contract_id' = ${param_idx}")
                params.append(filters['contract_id'])
                param_idx += 1
            
            if filter_conditions:
                filter_clause = "AND " + " AND ".join(filter_conditions)
        
        results = await self.db.fetch(f"""
            SELECT 
                id,
                source_type,
                source_id,
                chunk_index,
                content,
                metadata,
                ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) as similarity
            FROM embeddings
            WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
            {filter_clause}
            ORDER BY similarity DESC
            LIMIT $2
        """, *params)
        
        return [dict(r) for r in results]
    
    def combine_results(
        self,
        vector_results: List[Dict],
        keyword_results: List[Dict],
        vector_weight: float,
        keyword_weight: float
    ) -> List[Dict[str, Any]]:
        """Combine and rerank results from both searches."""
        # Create score map
        scores = {}
        
        # Add vector scores
        max_vector = max((r['similarity'] for r in vector_results), default=1)
        for r in vector_results:
            key = (r['source_type'], r['source_id'], r['chunk_index'])
            normalized = r['similarity'] / max_vector if max_vector > 0 else 0
            scores[key] = {
                'data': r,
                'vector_score': normalized,
                'keyword_score': 0
            }
        
        # Add keyword scores
        max_keyword = max((r['similarity'] for r in keyword_results), default=1)
        for r in keyword_results:
            key = (r['source_type'], r['source_id'], r['chunk_index'])
            normalized = r['similarity'] / max_keyword if max_keyword > 0 else 0
            
            if key in scores:
                scores[key]['keyword_score'] = normalized
            else:
                scores[key] = {
                    'data': r,
                    'vector_score': 0,
                    'keyword_score': normalized
                }
        
        # Calculate combined scores
        results = []
        for key, data in scores.items():
            combined_score = (
                data['vector_score'] * vector_weight +
                data['keyword_score'] * keyword_weight
            )
            result = data['data'].copy()
            result['combined_score'] = combined_score
            results.append(result)
        
        # Sort by combined score
        results.sort(key=lambda x: x['combined_score'], reverse=True)
        
        return results
```

---

## Response Generation

### Context Builder

```python
# backend/services/rag/context_builder.py

from typing import List, Dict, Any, Optional

from app.models import Business, Contract


class ContextBuilder:
    """Builds context for LLM from retrieved chunks."""
    
    MAX_CONTEXT_TOKENS = 8000  # Leave room for response
    
    def build_context(
        self,
        chunks: List[Dict[str, Any]],
        query_intent: str,
        business: Optional[Business] = None,
        contract: Optional[Contract] = None
    ) -> str:
        """
        Build context string from retrieved chunks.
        """
        context_parts = []
        
        # Add business context if available
        if business:
            context_parts.append(self.format_business_context(business))
        
        # Add contract context if this is about a specific contract
        if contract:
            context_parts.append(self.format_contract_context(contract))
        
        # Add retrieved chunks
        context_parts.append("## Relevant Information\n")
        
        for i, chunk in enumerate(chunks[:10]):  # Limit chunks
            source_info = self.format_source_info(chunk)
            context_parts.append(f"### Source {i+1} ({source_info})\n{chunk['content']}\n")
        
        return "\n".join(context_parts)
    
    def format_business_context(self, business: Business) -> str:
        """Format business info for context."""
        return f"""## Your Business Profile
- **Name**: {business.name}
- **Location**: {business.address_city}, {business.address_state}
- **Services**: {', '.join(business.service_types or [])}
- **Certifications**: {', '.join(c['type'] for c in (business.certifications or []))}
- **Service Radius**: {business.service_radius_miles} miles
"""
    
    def format_contract_context(self, contract: Contract) -> str:
        """Format contract info for context."""
        return f"""## Contract Details
- **Title**: {contract.title}
- **Entity**: {contract.entity_name}
- **Location**: {contract.location_city}, {contract.location_state}
- **Deadline**: {contract.deadline.strftime('%B %d, %Y at %I:%M %p') if contract.deadline else 'Not specified'}
- **Estimated Value**: ${contract.estimated_value_max:,.2f if contract.estimated_value_max else 'Not specified'}
- **Set-asides**: {', '.join(contract.set_asides) if contract.set_asides else 'None'}
- **Required Certifications**: {', '.join(contract.required_certifications) if contract.required_certifications else 'None'}
"""
    
    def format_source_info(self, chunk: Dict[str, Any]) -> str:
        """Format source attribution."""
        metadata = chunk.get('metadata', {})
        
        if chunk.get('source_type') == 'contract':
            return f"Contract: {metadata.get('entity_name', 'Unknown')}"
        elif chunk.get('source_type') == 'attachment':
            return f"Document: {metadata.get('filename', 'Unknown')}"
        else:
            return chunk.get('source_type', 'Unknown')
```

### Response Generator

```python
# backend/services/rag/generator.py

from typing import Dict, Any, Optional, List
import anthropic

from app.models import Business, Contract
from .context_builder import ContextBuilder


class ResponseGenerator:
    """Generates responses using Claude API."""
    
    def __init__(self):
        self.client = anthropic.AsyncAnthropic()
        self.context_builder = ContextBuilder()
    
    async def generate(
        self,
        query: str,
        chunks: List[Dict[str, Any]],
        query_info: Dict[str, Any],
        business: Optional[Business] = None,
        contract: Optional[Contract] = None,
        chat_history: List[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """
        Generate a response to the user's query.
        """
        # Build context
        context = self.context_builder.build_context(
            chunks=chunks,
            query_intent=query_info['intent'].value,
            business=business,
            contract=contract
        )
        
        # Build system prompt
        system_prompt = self.build_system_prompt(query_info['intent'].value)
        
        # Build messages
        messages = []
        
        # Add chat history
        if chat_history:
            for msg in chat_history[-6:]:  # Last 3 exchanges
                messages.append({
                    "role": msg['role'],
                    "content": msg['content']
                })
        
        # Add current query with context
        user_message = f"""Based on the following information, please answer my question.

{context}

---

**My Question**: {query}"""
        
        messages.append({
            "role": "user",
            "content": user_message
        })
        
        # Generate response
        response = await self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            system=system_prompt,
            messages=messages
        )
        
        return {
            'response': response.content[0].text,
            'sources': self.extract_sources(chunks),
            'tokens_used': response.usage.input_tokens + response.usage.output_tokens
        }
    
    def build_system_prompt(self, intent: str) -> str:
        """Build system prompt based on query intent."""
        base_prompt = """You are BidScout AI, an assistant helping small businesses find and win government contracts in Massachusetts.

Your role is to:
1. Answer questions about specific contracts, requirements, and deadlines
2. Explain certification eligibility (MBE, WBE, DBE, etc.)
3. Clarify compliance requirements (insurance, bonding, documents)
4. Help users understand if they qualify for opportunities

Guidelines:
- Be concise and actionable
- Always cite your sources when referencing specific information
- If you're unsure or the information isn't in the context, say so
- Use plain English, avoid jargon
- If the user might qualify for certifications they don't have, mention it
- Include specific deadlines and requirements when relevant"""
        
        intent_additions = {
            'certification_help': """
            
For certification questions:
- Explain eligibility requirements clearly
- Mention the issuing body (MA SDO, etc.)
- Note any cross-certification options
- Provide application guidance if asked""",
            
            'compliance_help': """
            
For compliance questions:
- List specific document requirements
- Note any dollar thresholds that change requirements
- Explain insurance minimums if applicable
- Mention bonding requirements for construction""",
            
            'deadline_check': """
            
For deadline questions:
- Give the specific date and time
- Note the timezone (usually EST)
- Mention pre-bid meetings or question deadlines
- Warn if deadline is approaching (<7 days)"""
        }
        
        return base_prompt + intent_additions.get(intent, "")
    
    def extract_sources(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, str]]:
        """Extract source citations from chunks used."""
        sources = []
        seen = set()
        
        for chunk in chunks[:5]:  # Top 5 sources
            metadata = chunk.get('metadata', {})
            source_key = (chunk.get('source_type'), chunk.get('source_id'))
            
            if source_key not in seen:
                seen.add(source_key)
                sources.append({
                    'type': chunk.get('source_type'),
                    'name': metadata.get('entity_name') or metadata.get('filename', 'Unknown'),
                    'relevance': chunk.get('combined_score', chunk.get('similarity', 0))
                })
        
        return sources
```

---

## Main RAG Service

```python
# backend/services/rag/service.py

from typing import Dict, Any, Optional, List
from datetime import datetime

from app.models import Business, Contract, ChatSession, ChatMessage
from app.db import get_db

from .query_processor import QueryProcessor
from .retriever import HybridRetriever
from .generator import ResponseGenerator


class RAGService:
    """Main RAG service orchestrating the Q&A pipeline."""
    
    def __init__(self):
        self.db = get_db()
        self.query_processor = QueryProcessor()
        self.retriever = HybridRetriever()
        self.generator = ResponseGenerator()
    
    async def answer(
        self,
        query: str,
        user_id: str,
        session_id: Optional[str] = None,
        contract_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Answer a user question using RAG.
        """
        start_time = datetime.utcnow()
        
        # Get business context
        business = await self.get_user_business(user_id)
        
        # Get contract context if specified
        contract = None
        if contract_id:
            contract = await self.db.contracts.find_one({'_id': contract_id})
        
        # Get chat history for session
        chat_history = []
        if session_id:
            chat_history = await self.get_chat_history(session_id)
        
        # Process query
        query_info = self.query_processor.process(
            query=query,
            context={'contract_id': contract_id} if contract_id else None
        )
        
        # Retrieve relevant chunks
        chunks = await self.retriever.retrieve(
            query=query_info['search_query'],
            filters=query_info['filters'],
            top_k=10
        )
        
        # Generate response
        result = await self.generator.generate(
            query=query,
            chunks=chunks,
            query_info=query_info,
            business=business,
            contract=contract,
            chat_history=chat_history
        )
        
        # Save to chat history
        if session_id:
            await self.save_chat_message(session_id, 'user', query)
            await self.save_chat_message(
                session_id, 'assistant', result['response'],
                metadata={
                    'sources': result['sources'],
                    'tokens': result['tokens_used'],
                    'latency_ms': (datetime.utcnow() - start_time).total_seconds() * 1000
                }
            )
        
        return {
            'answer': result['response'],
            'sources': result['sources'],
            'intent': query_info['intent'].value,
            'session_id': session_id
        }
    
    async def create_session(
        self,
        user_id: str,
        contract_id: Optional[str] = None,
        context_type: str = 'general'
    ) -> str:
        """Create a new chat session."""
        session = await self.db.chat_sessions.insert_one({
            'user_id': user_id,
            'contract_id': contract_id,
            'context_type': context_type,
            'is_active': True,
            'created_at': datetime.utcnow()
        })
        return str(session.inserted_id)
    
    async def get_chat_history(
        self,
        session_id: str,
        limit: int = 10
    ) -> List[Dict[str, str]]:
        """Get chat history for a session."""
        messages = await self.db.chat_messages.find({
            'session_id': session_id
        }).sort('created_at', -1).limit(limit).to_list()
        
        # Reverse to get chronological order
        messages.reverse()
        
        return [{'role': m['role'], 'content': m['content']} for m in messages]
    
    async def save_chat_message(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Dict = None
    ):
        """Save a chat message."""
        await self.db.chat_messages.insert_one({
            'session_id': session_id,
            'role': role,
            'content': content,
            'metadata': metadata or {},
            'created_at': datetime.utcnow()
        })
    
    async def get_user_business(self, user_id: str) -> Optional[Business]:
        """Get user's business profile."""
        return await self.db.businesses.find_one({'user_id': user_id})
```

---

## API Endpoints

```python
# backend/app/api/chat.py

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from app.auth import get_current_user
from app.schemas import ChatRequest, ChatResponse, SessionResponse
from services.rag.service import RAGService

router = APIRouter(prefix="/chat", tags=["chat"])

rag_service = RAGService()


@router.post("/", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    user = Depends(get_current_user)
):
    """
    Ask a question using RAG.
    """
    result = await rag_service.answer(
        query=request.query,
        user_id=str(user.id),
        session_id=request.session_id,
        contract_id=request.contract_id
    )
    
    return ChatResponse(**result)


@router.post("/sessions", response_model=SessionResponse)
async def create_session(
    contract_id: Optional[str] = None,
    context_type: str = "general",
    user = Depends(get_current_user)
):
    """Create a new chat session."""
    session_id = await rag_service.create_session(
        user_id=str(user.id),
        contract_id=contract_id,
        context_type=context_type
    )
    
    return SessionResponse(session_id=session_id)


@router.get("/sessions/{session_id}/history")
async def get_history(
    session_id: str,
    user = Depends(get_current_user)
):
    """Get chat history for a session."""
    history = await rag_service.get_chat_history(session_id)
    return {"messages": history}
```

---

## Certification Knowledge Base

For certification questions, we also maintain a curated knowledge base:

```python
# backend/services/rag/certification_kb.py

CERTIFICATION_KNOWLEDGE = {
    "MBE": {
        "name": "Minority Business Enterprise",
        "issuer": "MA Supplier Diversity Office (SDO)",
        "eligibility": [
            "Business must be at least 51% owned by minority individuals",
            "Minority owners must control day-to-day operations",
            "Owner must be a US citizen or lawful permanent resident",
            "Business must be independent (not controlled by non-minority firms)"
        ],
        "minority_groups": [
            "Black/African American",
            "Hispanic/Latino",
            "Asian (including Indian subcontinent)",
            "Native American/Alaska Native",
            "Native Hawaiian/Pacific Islander"
        ],
        "application_url": "https://www.mass.gov/how-to/apply-for-diversity-certification-as-a-massachusetts-based-business",
        "processing_time": "30-60 days",
        "cost": "Free",
        "duration": "3 years",
        "cross_certifications": ["DBE (with additional requirements)"],
        "tips": [
            "Must attend pre-certification webcast before applying",
            "GNEMSDC MBE certification can be cross-recognized by SDO",
            "Keep documentation of ownership percentages current"
        ]
    },
    "WBE": {
        "name": "Women Business Enterprise",
        "issuer": "MA Supplier Diversity Office (SDO)",
        "eligibility": [
            "Business must be at least 51% owned by women",
            "Women owners must control day-to-day operations",
            "Owner must be a US citizen or lawful permanent resident",
            "Business must be independent"
        ],
        "application_url": "https://www.mass.gov/how-to/apply-for-diversity-certification-as-a-massachusetts-based-business",
        "processing_time": "30-60 days",
        "cost": "Free",
        "duration": "3 years",
        "cross_certifications": ["WBENC certification recognized by SDO"],
        "tips": [
            "Center for Women & Enterprise (CWE) WBENC certification can be cross-recognized",
            "Same business can hold both MBE and WBE if applicable"
        ]
    },
    # ... more certifications
}


async def get_certification_info(cert_type: str) -> Dict[str, Any]:
    """Get detailed certification information."""
    return CERTIFICATION_KNOWLEDGE.get(cert_type.upper(), None)
```

---

## Testing

```python
# backend/tests/test_rag.py

import pytest
from services.rag.service import RAGService
from services.rag.query_processor import QueryProcessor, QueryIntent


class TestQueryProcessor:
    
    def test_intent_certification(self):
        processor = QueryProcessor()
        result = processor.process("Am I eligible for MBE certification?")
        assert result['intent'] == QueryIntent.CERTIFICATION_HELP
    
    def test_intent_deadline(self):
        processor = QueryProcessor()
        result = processor.process("When is the deadline for this bid?")
        assert result['intent'] == QueryIntent.DEADLINE_CHECK
    
    def test_entity_extraction(self):
        processor = QueryProcessor()
        result = processor.process("What are the requirements for contract EV00016920 in Boston?")
        assert 'EV00016920' in result['entities']['contract_ids']
        assert 'Boston' in result['entities']['locations']


class TestRAGService:
    
    @pytest.mark.asyncio
    async def test_answer_with_context(self):
        service = RAGService()
        # Mock the database and retriever
        # ...
        result = await service.answer(
            query="What insurance do I need?",
            user_id="test-user",
            contract_id="test-contract"
        )
        assert 'answer' in result
        assert 'sources' in result
```
