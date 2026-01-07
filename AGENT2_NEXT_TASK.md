# Agent 2: Next Task - Stripe Frontend UI

## Overview
While Agent 1 works on database setup, build the Stripe-related frontend components. These can use placeholder/mock data for now and will be connected to real Stripe APIs later.

## Tasks

### 1. Pricing Page (`/pricing`)
Create `src/app/pricing/page.tsx` with:
- Three pricing tiers: Free, Pro ($29/mo), Enterprise ($99/mo)
- Feature comparison table
- CTA buttons for each plan
- FAQ section (optional)

**Tier Features:**
| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Searches/day | 10 | Unlimited | Unlimited |
| Saved searches | 3 | 25 | Unlimited |
| Alerts | Email only | Email + SMS | All channels |
| API access | No | Yes | Yes |
| Support | Community | Email | Dedicated |

### 2. Subscription Management in Profile
Update `src/app/(protected)/profile/page.tsx` to add:
- Current plan display with badge
- "Upgrade" button for free users
- "Manage Subscription" button for paid users (links to Stripe portal placeholder)
- Billing history section (mock data for now)

### 3. Checkout Components
Create reusable components in `src/components/subscription/`:
- `PricingCard.tsx` - Individual plan card
- `PlanBadge.tsx` - Shows current plan (FREE/PRO/ENTERPRISE)
- `UpgradeButton.tsx` - Triggers checkout flow

### 4. Update Navigation
Add "Pricing" link to navbar for unauthenticated users.

## Design Guidelines
- Use existing shadcn/ui components (Card, Badge, Button)
- Follow the existing color scheme
- Make it responsive (mobile-first)
- Use Lucide icons (Check, X, Zap, Crown, Building2)

## Mock Stripe Integration
For now, create placeholder functions in `src/lib/stripe.ts`:
```typescript
export async function createCheckoutSession(priceId: string) {
  // TODO: Implement with real Stripe
  console.log('Creating checkout for:', priceId);
  return { url: '/dashboard?upgraded=true' };
}

export async function createPortalSession() {
  // TODO: Implement with real Stripe
  return { url: '/profile?portal=mock' };
}
```

## Files to Create/Modify
- [ ] `src/app/pricing/page.tsx` (new)
- [ ] `src/components/subscription/PricingCard.tsx` (new)
- [ ] `src/components/subscription/PlanBadge.tsx` (new)
- [ ] `src/components/subscription/UpgradeButton.tsx` (new)
- [ ] `src/lib/stripe.ts` (new - placeholder)
- [ ] `src/app/(protected)/profile/page.tsx` (update)
- [ ] `src/components/layout/navbar.tsx` (update)

## Success Criteria
- Pricing page renders with all three tiers
- Profile shows current subscription status
- Buttons have click handlers (even if mock)
- Responsive on mobile
- Build passes (`npm run build`)
