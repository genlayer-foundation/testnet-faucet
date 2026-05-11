import { getRedis } from "./redis";

export const REJECTION_REASONS = [
  "invalid_input",
  "gh_auth",
  "captcha",
  "rate_limit_ip",
  "rate_limit_addr",
  "rate_limit_gh",
  "eth_balance",
  "rpc_error",
  "recipient_balance",
  "lock_conflict",
  "faucet_empty",
  "daily_cap",
  "send_error",
  "unexpected_error",
] as const;

export type RejectionReason = (typeof REJECTION_REASONS)[number];

const KEYS = {
  totalClaims: "stats:total_claims",
  uniqueAddresses: "stats:unique_addresses",
  dailyClaims: (date: string) => `stats:daily:${date}`,
  hourlyClaims: (hour: string) => `stats:hourly:${hour}`,
  lastClaimAt: "stats:last_claim_at",
  rejection: (reason: RejectionReason) => `stats:rejections:${reason}`,
  rejectionTotal: "stats:rejections:total",
};

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function currentHourKey(): string {
  // YYYY-MM-DDTHH (UTC)
  return new Date().toISOString().slice(0, 13);
}

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0, 0, 0, 0
  ));
  return Math.max(1, Math.floor((next.getTime() - now.getTime()) / 1000));
}

const DEFAULT_DAILY_CAP = 150;

export function getDailyCapLimit(): number {
  const raw = process.env.MAX_CLAIMS_PER_DAY;
  if (raw === undefined || raw === "") return DEFAULT_DAILY_CAP;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_DAILY_CAP;
}

export async function recordClaim(address: string): Promise<void> {
  const redis = getRedis();
  const pipeline = redis.pipeline();

  pipeline.incr(KEYS.totalClaims);
  pipeline.sadd(KEYS.uniqueAddresses, address.toLowerCase());
  pipeline.incr(KEYS.dailyClaims(todayKey()));
  pipeline.incr(KEYS.hourlyClaims(currentHourKey()));
  pipeline.set(KEYS.lastClaimAt, new Date().toISOString());

  await pipeline.exec();
}

export async function recordRejection(reason: RejectionReason): Promise<void> {
  try {
    const redis = getRedis();
    const pipeline = redis.pipeline();
    pipeline.incr(KEYS.rejection(reason));
    pipeline.incr(KEYS.rejectionTotal);
    await pipeline.exec();
  } catch (err) {
    console.error("recordRejection failed:", reason, err);
  }
}

export async function getClaimsToday(): Promise<number> {
  const redis = getRedis();
  const count = await redis.get<number>(KEYS.dailyClaims(todayKey()));
  return count ?? 0;
}

export async function getDailyCap(): Promise<{
  used: number;
  limit: number;
  remaining: number;
  resetInSeconds: number;
}> {
  const limit = getDailyCapLimit();
  const used = await getClaimsToday();
  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetInSeconds: secondsUntilUtcMidnight(),
  };
}

export async function getStats() {
  const redis = getRedis();

  const rejectionKeys = REJECTION_REASONS.map((r) => KEYS.rejection(r));

  const [
    totalClaims,
    uniqueAddresses,
    claimsToday,
    claimsLastHour,
    lastClaimAt,
    rejectionTotal,
    ...rejectionCounts
  ] = await Promise.all([
    redis.get<number>(KEYS.totalClaims),
    redis.scard(KEYS.uniqueAddresses),
    redis.get<number>(KEYS.dailyClaims(todayKey())),
    redis.get<number>(KEYS.hourlyClaims(currentHourKey())),
    redis.get<string>(KEYS.lastClaimAt),
    redis.get<number>(KEYS.rejectionTotal),
    ...rejectionKeys.map((k) => redis.get<number>(k)),
  ]);

  const rejections: Record<string, number> = { total: rejectionTotal ?? 0 };
  REJECTION_REASONS.forEach((reason, i) => {
    rejections[reason] = rejectionCounts[i] ?? 0;
  });

  const limit = getDailyCapLimit();
  const used = claimsToday ?? 0;

  return {
    totalClaims: totalClaims ?? 0,
    uniqueAddresses: uniqueAddresses ?? 0,
    claimsToday: used,
    claimsLastHour: claimsLastHour ?? 0,
    lastClaimAt: lastClaimAt ?? null,
    dailyCap: {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetInSeconds: secondsUntilUtcMidnight(),
    },
    rejections,
  };
}
