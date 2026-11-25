import { getRedis } from "./redis";

const ADDR_PREFIX = "faucet:addr:";
const IP_PREFIX = "faucet:ip:";
const GH_PREFIX = "faucet:gh:";
const DAY_SECONDS = 86400;
const WEEK_SECONDS = 7 * DAY_SECONDS;
const ADDR_TTL_SECONDS = WEEK_SECONDS;
const GH_TTL_SECONDS = WEEK_SECONDS;
const IP_TTL_SECONDS = DAY_SECONDS;
const IP_MAX_CLAIMS = 5;

export async function checkAddressRateLimit(
  address: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const redis = getRedis();
  const key = `${ADDR_PREFIX}${address}`;
  const ttl = await redis.ttl(key);

  if (ttl > 0) {
    return { allowed: false, retryAfter: ttl };
  }
  return { allowed: true };
}

export async function checkIpRateLimit(
  ip: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const redis = getRedis();
  const key = `${IP_PREFIX}${ip}`;
  const claims = await redis.get<number>(key);

  if (claims !== null && claims >= IP_MAX_CLAIMS) {
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfter: ttl > 0 ? ttl : IP_TTL_SECONDS };
  }
  return { allowed: true };
}

export async function checkGitHubUserRateLimit(
  githubUserId: string
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const redis = getRedis();
  const key = `${GH_PREFIX}${githubUserId}`;
  const ttl = await redis.ttl(key);

  if (ttl > 0) {
    return { allowed: false, retryAfter: ttl };
  }
  return { allowed: true };
}

export async function recordRateLimit(
  address: string,
  ip: string,
  githubUserId?: string
): Promise<void> {
  const redis = getRedis();
  const pipeline = redis.pipeline();

  // Mark address as claimed (1 per week)
  pipeline.set(`${ADDR_PREFIX}${address}`, "1", { ex: ADDR_TTL_SECONDS });

  // Increment IP counter (5 per 24h — shared IPs like offices/cafes are OK)
  const ipKey = `${IP_PREFIX}${ip}`;
  pipeline.incr(ipKey);

  // Mark GitHub user as claimed (1 per week)
  if (githubUserId) {
    pipeline.set(`${GH_PREFIX}${githubUserId}`, "1", { ex: GH_TTL_SECONDS });
  }

  await pipeline.exec();

  // Set TTL on IP key only if it's new (don't reset existing TTL)
  const ttl = await redis.ttl(ipKey);
  if (ttl < 0) {
    await redis.expire(ipKey, IP_TTL_SECONDS);
  }
}
