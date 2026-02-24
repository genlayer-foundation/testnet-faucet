import { getRedis } from "./redis";

const ADDR_PREFIX = "faucet:addr:";
const IP_PREFIX = "faucet:ip:";
const TTL_SECONDS = 86400; // 24 hours
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
    return { allowed: false, retryAfter: ttl > 0 ? ttl : TTL_SECONDS };
  }
  return { allowed: true };
}

export async function recordRateLimit(
  address: string,
  ip: string
): Promise<void> {
  const redis = getRedis();
  const pipeline = redis.pipeline();

  // Mark address as claimed (1 per 24h)
  pipeline.set(`${ADDR_PREFIX}${address}`, "1", { ex: TTL_SECONDS });

  // Increment IP counter (3 per 24h)
  const ipKey = `${IP_PREFIX}${ip}`;
  pipeline.incr(ipKey);

  await pipeline.exec();

  // Set TTL on IP key only if it's new (don't reset existing TTL)
  const ttl = await redis.ttl(ipKey);
  if (ttl < 0) {
    await redis.expire(ipKey, TTL_SECONDS);
  }
}
