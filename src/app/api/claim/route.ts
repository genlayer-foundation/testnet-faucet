import { NextRequest, NextResponse } from "next/server";
import { parseEther } from "viem";
import { claimSchema } from "@/lib/validation";
import { verifyTurnstile } from "@/lib/turnstile";
import { getAddressRateLimiter, getIpRateLimiter } from "@/lib/rate-limit";
import { sendGEN, isRecipientEligible, getFaucetBalance } from "@/lib/faucet";
import { recordClaim } from "@/lib/stats";
import { getRedis } from "@/lib/redis";
import type { ClaimResponse } from "@/types";

export async function POST(
  request: NextRequest
): Promise<NextResponse<ClaimResponse>> {
  try {
    const body = await request.json();
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { address, turnstileToken } = parsed.data;
    const normalizedAddress = address.toLowerCase() as `0x${string}`;

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const turnstileValid = await verifyTurnstile(turnstileToken, clientIp);
    if (!turnstileValid) {
      return NextResponse.json(
        {
          success: false,
          error: "CAPTCHA verification failed. Please try again.",
        },
        { status: 400 }
      );
    }

    const ipLimiter = getIpRateLimiter();
    const ipResult = await ipLimiter.limit(clientIp);
    if (!ipResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests from this IP. Please try again later.",
          retryAfter: Math.ceil((ipResult.reset - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    const addrLimiter = getAddressRateLimiter();
    const addrResult = await addrLimiter.limit(normalizedAddress);
    if (!addrResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "This address has already claimed GEN in the last 24 hours.",
          retryAfter: Math.ceil((addrResult.reset - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    const eligible = await isRecipientEligible(normalizedAddress);
    if (!eligible) {
      const threshold = Number(process.env.BALANCE_THRESHOLD) || 1000;
      return NextResponse.json(
        {
          success: false,
          error: `This address already has more than ${threshold} GEN.`,
        },
        { status: 400 }
      );
    }

    const redis = getRedis();
    const lockKey = `lock:${normalizedAddress}`;
    const lockAcquired = await redis.set(lockKey, "1", { nx: true, ex: 60 });
    if (!lockAcquired) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A transaction is already being processed for this address.",
        },
        { status: 409 }
      );
    }

    try {
      const faucetBalance = await getFaucetBalance();
      const claimAmount = Number(process.env.CLAIM_AMOUNT) || 100;
      if (parseFloat(faucetBalance) < claimAmount) {
        return NextResponse.json(
          {
            success: false,
            error: "Faucet is currently empty. Please try again later.",
          },
          { status: 503 }
        );
      }

      const txHash = await sendGEN(normalizedAddress);

      await recordClaim(normalizedAddress);

      const explorerUrl = `${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer-asimov.genlayer.com"}/tx/${txHash}`;
      return NextResponse.json({
        success: true,
        txHash,
        explorerUrl,
      });
    } finally {
      await redis.del(lockKey);
    }
  } catch (error) {
    console.error("Claim error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}
