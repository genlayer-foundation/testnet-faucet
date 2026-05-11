import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { claimSchema } from "@/lib/validation";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkAddressRateLimit, checkIpRateLimit, checkGitHubUserRateLimit, recordRateLimit } from "@/lib/rate-limit";
import { sendGEN, isRecipientEligible, getFaucetBalance, checkMainnetEthBalance } from "@/lib/faucet";
import { recordClaim, recordRejection, getDailyCap } from "@/lib/stats";
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
      await recordRejection("invalid_input");
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }
    const { address, turnstileToken, website } = parsed.data;
    const normalizedAddress = address.toLowerCase() as `0x${string}`;

    // 2. Require GitHub authentication
    const session = await auth();
    if (!session?.user?.githubId) {
      await recordRejection("gh_auth");
      return NextResponse.json(
        { success: false, error: "You must sign in with GitHub to claim GEN." },
        { status: 401 }
      );
    }
    const githubUserId = session.user.githubId;

    // 3. Honeypot check — bots fill hidden fields, real users don't
    if (website) {
      return NextResponse.json({
        success: true,
        txHash: `0x${"0".repeat(64)}`,
        explorerUrl: `${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://zksync-os-testnet-genlayer.explorer.zksync.dev"}/tx/0x${"0".repeat(64)}`,
      });
    }

    // 4. Verify CAPTCHA
    const clientIp =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const turnstileResult = await verifyTurnstile(turnstileToken, clientIp);
    if (!turnstileResult.success) {
      await recordRejection("captcha");
      return NextResponse.json(
        { success: false, error: "CAPTCHA verification failed. Please try again." },
        { status: 400 }
      );
    }

    // 5. Check IP rate limit (read-only, does not consume)
    const ipCheck = await checkIpRateLimit(clientIp);
    if (!ipCheck.allowed) {
      await recordRejection("rate_limit_ip");
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests from this IP. Please try again later.",
          retryAfter: ipCheck.retryAfter,
        },
        { status: 429 }
      );
    }

    // 6. Check address rate limit (read-only, does not consume)
    const addrCheck = await checkAddressRateLimit(normalizedAddress);
    if (!addrCheck.allowed) {
      await recordRejection("rate_limit_addr");
      return NextResponse.json(
        {
          success: false,
          error: "This address has already claimed GEN in the last 7 days.",
          retryAfter: addrCheck.retryAfter,
        },
        { status: 429 }
      );
    }

    // 7. Check GitHub user rate limit (1 claim per 7 days per GitHub account)
    const ghCheck = await checkGitHubUserRateLimit(githubUserId);
    if (!ghCheck.allowed) {
      await recordRejection("rate_limit_gh");
      return NextResponse.json(
        {
          success: false,
          error: "Your GitHub account has already claimed GEN in the last 7 days.",
          retryAfter: ghCheck.retryAfter,
        },
        { status: 429 }
      );
    }

    // 8. Check mainnet ETH balance (anti-sybil: must hold real ETH)
    try {
      const mainnetCheck = await checkMainnetEthBalance(normalizedAddress);
      if (!mainnetCheck.eligible) {
        await recordRejection("eth_balance");
        const minBalance = Number(process.env.MIN_ETH_BALANCE ?? 0.01);
        return NextResponse.json(
          {
            success: false,
            error: `Your wallet must hold at least ${minBalance} ETH on Ethereum mainnet to claim GEN. Your balance: ${mainnetCheck.balance} ETH.`,
          },
          { status: 403 }
        );
      }
    } catch (error) {
      console.error("Mainnet balance check failed:", error);
      await recordRejection("rpc_error");
      return NextResponse.json(
        { success: false, error: "Unable to verify mainnet ETH balance. Please try again later." },
        { status: 502 }
      );
    }

    // 9. Check GEN balance threshold
    const eligible = await isRecipientEligible(normalizedAddress);
    if (!eligible) {
      await recordRejection("recipient_balance");
      const threshold = Number(process.env.BALANCE_THRESHOLD) || 1000;
      return NextResponse.json(
        { success: false, error: `This address already has more than ${threshold} GEN.` },
        { status: 400 }
      );
    }

    // 10. Global daily cap — bounds worst-case loss regardless of sybil sophistication
    const cap = await getDailyCap();
    if (cap.used >= cap.limit) {
      await recordRejection("daily_cap");
      return NextResponse.json(
        {
          success: false,
          error: "The faucet has reached its daily limit. Please try again tomorrow.",
          retryAfter: cap.resetInSeconds,
        },
        { status: 503 }
      );
    }

    // 11. Acquire processing lock
    const redis = getRedis();
    const lockKey = `lock:${normalizedAddress}`;
    const lockAcquired = await redis.set(lockKey, "1", { nx: true, ex: 60 });
    if (!lockAcquired) {
      await recordRejection("lock_conflict");
      return NextResponse.json(
        { success: false, error: "A transaction is already being processed for this address." },
        { status: 409 }
      );
    }

    try {
      // 12. Check faucet balance
      const faucetBalance = await getFaucetBalance();
      const claimAmount = Number(process.env.CLAIM_AMOUNT) || 100;
      if (parseFloat(faucetBalance) < claimAmount) {
        await recordRejection("faucet_empty");
        return NextResponse.json(
          { success: false, error: "Faucet is currently empty. Please try again later." },
          { status: 503 }
        );
      }

      // 13. Send transaction
      let txHash: `0x${string}`;
      try {
        txHash = await sendGEN(normalizedAddress);
      } catch (sendErr) {
        console.error("sendGEN failed:", sendErr);
        await recordRejection("send_error");
        return NextResponse.json(
          { success: false, error: "Failed to send transaction. Please try again." },
          { status: 502 }
        );
      }

      // 14. Only record rate limit and stats AFTER successful send
      await Promise.all([
        recordRateLimit(normalizedAddress, clientIp, githubUserId),
        recordClaim(normalizedAddress),
      ]);

      const explorerUrl = `${process.env.NEXT_PUBLIC_EXPLORER_URL || "https://zksync-os-testnet-genlayer.explorer.zksync.dev"}/tx/${txHash}`;
      return NextResponse.json({ success: true, txHash, explorerUrl });
    } finally {
      await redis.del(lockKey);
    }
  } catch (error) {
    console.error("Claim error:", error);
    await recordRejection("unexpected_error");
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
