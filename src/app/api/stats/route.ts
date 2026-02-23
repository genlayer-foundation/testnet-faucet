import { NextResponse } from "next/server";
import { getStats } from "@/lib/stats";
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
    return NextResponse.json({
      totalClaims: 0,
      uniqueAddresses: 0,
      claimsToday: 0,
      faucetBalance: "0",
      lastClaimAt: null,
    });
  }
}
