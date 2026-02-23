export interface ClaimRequest {
  address: string;
  turnstileToken: string;
}

export interface ClaimResponse {
  success: boolean;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
  retryAfter?: number;
}

export interface FaucetStats {
  totalClaims: number;
  uniqueAddresses: number;
  claimsToday: number;
  faucetBalance: string;
  lastClaimAt: string | null;
}
