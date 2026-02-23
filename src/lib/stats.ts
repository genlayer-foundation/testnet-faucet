import { getRedis } from "./redis";

const KEYS = {
  totalClaims: "stats:total_claims",
  uniqueAddresses: "stats:unique_addresses",
  dailyClaims: (date: string) => `stats:daily:${date}`,
  lastClaimAt: "stats:last_claim_at",
};

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export async function recordClaim(address: string): Promise<void> {
  const redis = getRedis();
  const pipeline = redis.pipeline();

  pipeline.incr(KEYS.totalClaims);
  pipeline.sadd(KEYS.uniqueAddresses, address.toLowerCase());
  pipeline.incr(KEYS.dailyClaims(todayKey()));
  pipeline.set(KEYS.lastClaimAt, new Date().toISOString());

  await pipeline.exec();
}

export async function getStats() {
  const redis = getRedis();

  const [totalClaims, uniqueAddresses, claimsToday, lastClaimAt] =
    await Promise.all([
      redis.get<number>(KEYS.totalClaims),
      redis.scard(KEYS.uniqueAddresses),
      redis.get<number>(KEYS.dailyClaims(todayKey())),
      redis.get<string>(KEYS.lastClaimAt),
    ]);

  return {
    totalClaims: totalClaims ?? 0,
    uniqueAddresses: uniqueAddresses ?? 0,
    claimsToday: claimsToday ?? 0,
    lastClaimAt: lastClaimAt ?? null,
  };
}
