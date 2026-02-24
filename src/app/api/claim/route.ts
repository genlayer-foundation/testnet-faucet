import { NextRequest, NextResponse } from "next/server";
import { claimSchema } from "@/lib/validation";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkAddressRateLimit, checkIpRateLimit, recordRateLimit } from "@/lib/rate-limit";
import { sendGEN, isRecipientEligible, getFaucetBalance } from "@/lib/faucet";
import { recordClaim } from "@/lib/stats";
import { getRedis } from "@/lib/redis";
import type { ClaimResponse } from "@/types";

export async function POST(
  request: NextRequest
): Promise<NextResponse<ClaimResponse>> {
  try {
    // 1. Validate input
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

    // 2. Verify CAPTCHA
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const turnstileValid = await verifyTurnstile(turnstileToken, clientIp);
    if (!turnstileValid) {
      return NextResponse.json(
        { success: false, error: "CAPTCHA verification failed. Please try again." },
        { status: 400 }
      );
    }

    // 3. Check IP rate limit (read-only, does not consume)
    const ipCheck = await checkIpRateLimit(clientIp);
    if (!ipCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests from this IP. Please try again later.",
          retryAfter: ipCheck.retryAfter,
        },
        { status: 429 }
      );
    }

    // 4. Check address rate limit (read-only, does not consume)
    const addrCheck = await checkAddressRateLimit(normalizedAddress);
    if (!addrCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "This address has already claimed GEN in the last 24 hours.",
          retryAfter: addrCheck.retryAfter,
        },
        { status: 429 }
      );
    }

    // 5. Check balance threshold
    const eligible = await isRecipientEligible(normalizedAddress);
    if (!eligible) {
      const threshold = Number(process.env.BALANCE_THRESHOLD) || 1000;
      return NextResponse.json(
        { success: false, error: `This address already has more than ${threshold} GEN.` },
        { status: 400 }
      );
    }

    // 6. Acquire processing lock
    const redis = getRedis();
    const lockKey = `lock:${normalizedAddress}`;
    const lockAcquired = await redis.set(lockKey, "1", { nx: true, ex: 60 });
    if (!lockAcquired) {
      return NextResponse.json(
        { success: false, error: "A transaction is already being processed for this address." },
        { status: 409 }
      );
    }

    try {
      // 7. Check faucet balance
      const faucetBalance = await getFaucetBalance();
      const claimAmount = Number(process.env.CLAIM_AMOUNT) || 100;
      if (parseFloat(faucetBalance) < claimAmount) {
        return NextResponse.json(
          { success: false, error: "Faucet is currently empty. Please try again later." },
          { status: 503 }
        );
      }

      // 8. Send transaction
      const txHash = await sendGEN(normalizedAddress);

      // 9. Only record rate limit and stats AFTER successful send
      await Promise.all([
        recordRateLimit(normalizedAddress, clientIp),
        recordClaim(normalizedAddress),
      ]);

      const explorerUrl = `${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer-asimov.genlayer.com"}/tx/${txHash}`;
      return NextResponse.json({ success: true, txHash, explorerUrl });
    } finally {
      await redis.del(lockKey);
    }
  } catch (error) {
    console.error("Claim error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
