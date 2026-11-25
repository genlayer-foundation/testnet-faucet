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

export interface DailyCap {
  used: number;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}

export interface FaucetStats {
  totalClaims: number;
  uniqueAddresses: number;
  claimsToday: number;
  claimsLastHour: number;
  faucetBalance: string;
  lastClaimAt: string | null;
  dailyCap: DailyCap;
  rejections: Record<string, number>;
}
