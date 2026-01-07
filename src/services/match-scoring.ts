import { ContractLead, CompanyProfile, CERTIFICATION_TYPES } from '@/types';

interface MatchResult {
  score: number;
  reasons: string[];
}

/**
 * Calculate match score between a contract and company profile
 *
 * Score breakdown (0-100):
 * - NAICS match: 0-40 points
 * - Set-aside/certification match: 0-30 points
 * - Location fit: 0-15 points
 * - Contract size fit: 0-15 points
 */
export function calculateMatchScore(
  contract: ContractLead,
  profile: CompanyProfile
): MatchResult {
  const reasons: string[] = [];
  let score = 0;

  // 1. NAICS Code Match (0-40 points)
  const naicsScore = calculateNaicsScore(contract, profile);
  score += naicsScore.points;
  if (naicsScore.matched) {
    reasons.push(naicsScore.reason);
  }

  // 2. Set-aside / Certification Match (0-30 points)
  const certScore = calculateCertificationScore(contract, profile);
  score += certScore.points;
  if (certScore.matched) {
    reasons.push(certScore.reason);
  }

  // 3. Location Fit (0-15 points)
  const locationScore = calculateLocationScore(contract, profile);
  score += locationScore.points;
  if (locationScore.matched) {
    reasons.push(locationScore.reason);
  }

  // 4. Contract Size Fit (0-15 points)
  const sizeScore = calculateSizeScore(contract, profile);
  score += sizeScore.points;
  if (sizeScore.matched) {
    reasons.push(sizeScore.reason);
  }

  return { score, reasons };
}

function calculateNaicsScore(
  contract: ContractLead,
  profile: CompanyProfile
): { points: number; matched: boolean; reason: string } {
  if (!contract.naicsCodes || contract.naicsCodes.length === 0) {
    // No NAICS on contract - give partial points
    return { points: 20, matched: false, reason: '' };
  }

  if (!profile.naicsCodes || profile.naicsCodes.length === 0) {
    return { points: 0, matched: false, reason: '' };
  }

  // Check for overlap
  const overlap = contract.naicsCodes.filter((code) =>
    profile.naicsCodes.some((profileCode) => {
      // Match exact or prefix (e.g., 541 matches 541330)
      return (
        code === profileCode ||
        code.startsWith(profileCode) ||
        profileCode.startsWith(code)
      );
    })
  );

  if (overlap.length > 0) {
    // Full match - 40 points
    return {
      points: 40,
      matched: true,
      reason: `NAICS match (${overlap[0]})`,
    };
  }

  return { points: 0, matched: false, reason: '' };
}

function calculateCertificationScore(
  contract: ContractLead,
  profile: CompanyProfile
): { points: number; matched: boolean; reason: string } {
  if (!contract.setAsideType) {
    // No set-aside requirement - any business can bid, partial points
    return { points: 15, matched: false, reason: '' };
  }

  if (!profile.certifications || profile.certifications.length === 0) {
    return { points: 0, matched: false, reason: '' };
  }

  // Check if user's certifications match contract's set-aside
  for (const cert of profile.certifications) {
    const certConfig = CERTIFICATION_TYPES.find((c) => c.code === cert);
    if (certConfig) {
      // Check if contract's setAsideType matches any of the certification's codes
      if (certConfig.setAsideCodes.includes(contract.setAsideType as never)) {
        const certLabel = certConfig.label;
        return {
          points: 30,
          matched: true,
          reason: `Set-aside eligible (${certLabel})`,
        };
      }
    }
  }

  // Small business general set-aside
  if (
    contract.setAsideType === 'SBA' ||
    contract.setAsideType === 'SBP'
  ) {
    // Any small business can potentially bid
    return {
      points: 15,
      matched: true,
      reason: 'Small business set-aside',
    };
  }

  return { points: 0, matched: false, reason: '' };
}

function calculateLocationScore(
  contract: ContractLead,
  profile: CompanyProfile
): { points: number; matched: boolean; reason: string } {
  if (!contract.placeOfPerformance) {
    // No location specified - remote work possible, partial points
    return { points: 8, matched: false, reason: '' };
  }

  if (!profile.preferredStates || profile.preferredStates.length === 0) {
    // User has no location preference - partial points
    return { points: 8, matched: false, reason: '' };
  }

  // Check if contract location contains any of user's preferred states
  const location = contract.placeOfPerformance.toUpperCase();

  for (const state of profile.preferredStates) {
    // Check for state code or full name
    if (location.includes(state.toUpperCase())) {
      return {
        points: 15,
        matched: true,
        reason: `Location match (${state})`,
      };
    }
  }

  // Check for common location indicators
  if (
    location.includes('REMOTE') ||
    location.includes('ANYWHERE') ||
    location.includes('NATIONWIDE')
  ) {
    return {
      points: 10,
      matched: true,
      reason: 'Remote/nationwide eligible',
    };
  }

  return { points: 0, matched: false, reason: '' };
}

function calculateSizeScore(
  contract: ContractLead,
  profile: CompanyProfile
): { points: number; matched: boolean; reason: string } {
  const contractValue = contract.estimatedValue || contract.awardAmount;

  if (!contractValue) {
    // No value specified - partial points
    return { points: 8, matched: false, reason: '' };
  }

  const value = Number(contractValue);
  const min = profile.minContractValue;
  const max = profile.maxContractValue;

  // No preferences set - partial points
  if (min === null && max === null) {
    return { points: 8, matched: false, reason: '' };
  }

  // Check if contract is within preferred range
  const aboveMin = min === null || value >= min;
  const belowMax = max === null || value <= max;

  if (aboveMin && belowMax) {
    const formatted = formatCurrency(value);
    return {
      points: 15,
      matched: true,
      reason: `Size fit (${formatted})`,
    };
  }

  // Partial match - within 50% of range
  if (min !== null && value < min) {
    const ratio = value / min;
    if (ratio > 0.5) {
      return { points: 8, matched: false, reason: '' };
    }
  }

  if (max !== null && value > max) {
    const ratio = max / value;
    if (ratio > 0.5) {
      return { points: 8, matched: false, reason: '' };
    }
  }

  return { points: 0, matched: false, reason: '' };
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

/**
 * Score and sort contracts by match quality
 */
export function scoreAndSortContracts(
  contracts: ContractLead[],
  profile: CompanyProfile,
  minScore = 0
): Array<{ contract: ContractLead; matchScore: number; matchReasons: string[] }> {
  const scored = contracts.map((contract) => {
    const { score, reasons } = calculateMatchScore(contract, profile);
    return {
      contract,
      matchScore: score,
      matchReasons: reasons,
    };
  });

  // Filter by minimum score and sort descending
  return scored
    .filter((item) => item.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore);
}
