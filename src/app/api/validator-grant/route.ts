import { NextRequest, NextResponse } from "next/server";
import { formatEther, parseEther } from "viem";
import { auth } from "@/auth";
import { claimSchema } from "@/lib/validation";
import { verifyTurnstile } from "@/lib/turnstile";
import { checkIpRateLimit, recordIpRateLimit } from "@/lib/rate-limit";
import { getFaucetBalanceWei, getFaucetChainIO } from "@/lib/faucet";
import { getGenlayerChain } from "@/lib/chain";
import {
  sendTracked,
  settlePending,
  type SendOutcome,
} from "@/lib/tracked-send";
import {
  acquireGrantLock,
  acquireSignerLock,
  dailyKey,
  clearPendingGrant,
  getGitHubGrantAddress,
  getGrantConfig,
  getGrantsToday,
  getMainnetStanding,
  getNonceSpentSeenAt,
  getPendingGrant,
  hasReceivedGrant,
  isGrantEnabled,
  markNonceSpentSeen,
  recordGrant,
  reservePendingGrant,
  releaseFailedGrant,
  releaseGrantLock,
  releaseSignerLock,
} from "@/lib/validator-grant";
import type { ClaimResponse } from "@/types";

// The send waits up to 15s for the receipt on top of the checks.
export const maxDuration = 60;

const GAS_MARGIN_WEI = parseEther("1");

const ALREADY_GRANTED = "This wallet has already received the validator grant.";
const GITHUB_USED =
  "Your GitHub account has already been used for a validator grant with another wallet.";
const IN_PROGRESS =
  "A validator grant is already being processed for this wallet or GitHub account. Please try again in a minute.";
const CAP_REACHED =
  "Today's validator grants have all been claimed. Please try again tomorrow (UTC).";

function refuse(error: string, status: number, retryAfter?: number) {
  return NextResponse.json<ClaimResponse>(
    { success: false, error, ...(retryAfter ? { retryAfter } : {}) },
    { status }
  );
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<ClaimResponse>> {
  try {
    // 1. Validate input
    const body = await request.json();
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      return refuse(parsed.error.issues[0].message, 400);
    }
    const { address, turnstileToken, website } = parsed.data;
    if (website) {
      return refuse("The validator grant is not available right now.", 400);
    }
    const normalizedAddress = address.toLowerCase() as `0x${string}`;

    // 2. Fail closed when the grant is switched off or not configured
    if (!isGrantEnabled()) {
      return refuse("The validator grant is not available right now.", 503);
    }
    const config = getGrantConfig();

    // 3. Require GitHub authentication (same gate as the normal claim)
    const session = await auth();
    if (!session?.user?.githubId) {
      return refuse("You must sign in with GitHub to claim the validator grant.", 401);
    }
    const githubUserId = session.user.githubId;

    // 4. Verify CAPTCHA
    const clientIp =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";

    const turnstileResult = await verifyTurnstile(turnstileToken, clientIp);
    if (!turnstileResult.success) {
      return refuse("CAPTCHA verification failed. Please try again.", 400);
    }

    // 5. Check IP rate limit (shared with normal claims, read-only here)
    const ipCheck = await checkIpRateLimit(clientIp);
    if (!ipCheck.allowed) {
      return refuse(
        "Too many requests from this IP. Please try again later.",
        429,
        ipCheck.retryAfter
      );
    }

    // 6. Once per wallet and once per GitHub account, forever
    if (await hasReceivedGrant(normalizedAddress)) {
      return refuse(ALREADY_GRANTED, 409);
    }
    const githubWallet = await getGitHubGrantAddress(githubUserId);
    if (githubWallet && githubWallet !== normalizedAddress) {
      return refuse(GITHUB_USED, 409);
    }

    // 7. A send whose outcome is not known yet skips the eligibility checks:
    //    it is only ever settled, never sent again.
    const pendingEarly = await getPendingGrant(normalizedAddress);

    if (!pendingEarly) {
      // 8. Global daily cap (cheap early answer; enforced atomically below)
      if ((await getGrantsToday()) >= config.dailyCap) {
        return refuse(CAP_REACHED, 429);
      }

      // 9. Ethereum mainnet standing - any failure refuses the grant
      let standing: { balanceWei: bigint; txCount: number };
      try {
        standing = await getMainnetStanding(normalizedAddress);
      } catch (error) {
        console.error("Validator grant: mainnet check failed:", error);
        return refuse(
          "Could not check your Ethereum mainnet balance right now. Nothing was sent. Please try again later.",
          503
        );
      }
      if (standing.balanceWei < config.minEthWei) {
        return refuse(
          `This wallet holds ${Number(formatEther(standing.balanceWei)).toFixed(4)} ETH on Ethereum mainnet. At least ${config.minEth} ETH is needed for the validator grant.`,
          403
        );
      }
      if (standing.txCount < config.minTxCount) {
        return refuse(
          `This wallet has sent ${standing.txCount} transactions on Ethereum mainnet. At least ${config.minTxCount} are needed for the validator grant.`,
          403
        );
      }
    }

    // 10. Processing locks: one request per wallet and per GitHub account
    const githubLock = `gh:${githubUserId}`;
    if (!(await acquireGrantLock(normalizedAddress))) {
      return refuse(IN_PROGRESS, 409);
    }
    if (!(await acquireGrantLock(githubLock))) {
      await releaseGrantLock(normalizedAddress).catch(() => {});
      return refuse(IN_PROGRESS, 409);
    }

    try {
      // Everything checked before the locks is checked again inside them.
      if (await hasReceivedGrant(normalizedAddress)) {
        return refuse(ALREADY_GRANTED, 409);
      }

      const io = getFaucetChainIO();

      // 11. Settle an earlier send instead of sending again
      const pending = await getPendingGrant(normalizedAddress);
      if (pending) {
        let outcome: SendOutcome;
        try {
          const nonceSpentSeenAt = await getNonceSpentSeenAt(pending.txHash);
          outcome = await settlePending(
            { ...pending, nonceSpentSeenAt },
            io,
            { onNonceSpent: (at) => markNonceSpentSeen(pending.txHash, at) }
          );
        } catch (error) {
          console.error("Validator grant: could not settle pending send:", error);
          outcome = { state: "unknown", txHash: pending.txHash };
        }
        return await respond(outcome, normalizedAddress, clientIp, pending);
      }
      if (pendingEarly) {
        // Another request settled it as failed while we waited for the lock.
        return refuse(
          "Your earlier request did not go through and nothing was sent. Please try again.",
          409
        );
      }

      // One grant signs at a time (shared faucet nonce).
      if (!(await acquireSignerLock())) {
        return refuse(
          "The faucet is busy with other grants. Nothing was sent. Please try again in a minute.",
          503
        );
      }

      // Read just before the reservation so a request that straddles UTC
      // midnight counts against the right day.
      let slotKey = dailyKey();
      let outcome: SendOutcome;
      try {
        const faucetBalance = await getFaucetBalanceWei();
        if (faucetBalance < config.amountWei + GAS_MARGIN_WEI) {
          return refuse(
            "The faucet cannot cover a validator grant right now. Please try again later.",
            503
          );
        }

        const result = await sendTracked(
          normalizedAddress,
          config.amountWei,
          io,
          (signed) => {
            slotKey = dailyKey();
            return reservePendingGrant(
              normalizedAddress,
              { ...signed, githubUserId, slotKey },
              config.dailyCap
            );
          }
        );
        switch (result) {
          case "granted":
            return refuse(ALREADY_GRANTED, 409);
          case "pending":
            return refuse(IN_PROGRESS, 409);
          case "github_used":
            return refuse(GITHUB_USED, 409);
          case "cap_reached":
            return refuse(CAP_REACHED, 429);
          default:
            outcome = result;
        }
      } catch (error) {
        // The reservation may have committed before its reply was lost.
        console.error("Validator grant: preparation or reservation failed:", error);
        return refuse("Could not complete your request. Please try again in a few minutes.", 502);
      } finally {
        await releaseSignerLock().catch(() => {});
      }

      return await respond(outcome, normalizedAddress, clientIp, {
        githubUserId,
        slotKey,
      });
    } finally {
      await releaseGrantLock(githubLock).catch(() => {});
      await releaseGrantLock(normalizedAddress).catch(() => {});
    }
  } catch (error) {
    console.error("Validator grant error:", error);
    return refuse("An unexpected error occurred. Please try again.", 500);
  }
}

async function respond(
  outcome: SendOutcome,
  address: `0x${string}`,
  clientIp: string,
  grant: { githubUserId: string; slotKey: string }
): Promise<NextResponse<ClaimResponse>> {
  const { amount } = getGrantConfig();
  const explorerUrl = `${getGenlayerChain().blockExplorers.default.url}/tx/${outcome.txHash}`;

  if (outcome.state === "confirmed") {
    // The pending record is removed only once the permanent marker exists, so
    // a lost write here can never open the door to a second send.
    try {
      await recordGrant(address, outcome.txHash, grant.githubUserId);
      await clearPendingGrant(address).catch(() => {});
    } catch (error) {
      console.error(
        `Validator grant: ${outcome.txHash} to ${address} is confirmed but the once-ever marker was NOT written (pending record kept):`,
        error
      );
    }
    await recordIpRateLimit(clientIp).catch((error) =>
      console.error("Validator grant: IP counter not recorded:", error)
    );
    return NextResponse.json({
      success: true,
      txHash: outcome.txHash,
      explorerUrl,
      amount,
    });
  }

  if (outcome.state === "failed") {
    console.error(
      `Validator grant: ${outcome.txHash} to ${address} failed: ${outcome.reason}`
    );
    await releaseFailedGrant(address, outcome.txHash, grant);
    return refuse(
      "The transfer did not go through and nothing was sent. Please try again.",
      502
    );
  }

  console.warn(
    `Validator grant: outcome of ${outcome.txHash} to ${address} is not known yet`
  );
  return NextResponse.json<ClaimResponse>(
    {
      success: false,
      pending: true,
      txHash: outcome.txHash,
      explorerUrl,
      amount,
      error:
        "Your grant was submitted but is not confirmed yet. It cannot be paid twice. Check the transaction, or submit again in a few minutes to see the result.",
    },
    { status: 202 }
  );
}
