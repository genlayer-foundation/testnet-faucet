import { NextResponse } from "next/server";
import { getStats, getDailyCapLimit, REJECTION_REASONS } from "@/lib/stats";
import { getFaucetBalance } from "@/lib/faucet";
import type { FaucetStats } from "@/types";

export const revalidate = 30;

export async function GET(): Promise<NextResponse<FaucetStats>> {
  try {
    const [stats, faucetBalance] = await Promise.all([
      getStats(),
      getFaucetBalance(),
    ]);

    return NextResponse.json({
      ...stats,
      faucetBalance,
    });
  } catch {
    const limit = getDailyCapLimit();
    const rejections: Record<string, number> = { total: 0 };
    REJECTION_REASONS.forEach((reason) => {
      rejections[reason] = 0;
    });
    return NextResponse.json({
      totalClaims: 0,
      uniqueAddresses: 0,
      claimsToday: 0,
      claimsLastHour: 0,
      faucetBalance: "0",
      lastClaimAt: null,
      dailyCap: { used: 0, limit, remaining: limit, resetInSeconds: 0 },
      rejections,
    });
  }
}
