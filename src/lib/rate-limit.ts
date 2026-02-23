import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "./redis";

export function getAddressRateLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.fixedWindow(1, "24h"),
    prefix: "faucet:addr",
    analytics: true,
  });
}

export function getIpRateLimiter() {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.fixedWindow(3, "24h"),
    prefix: "faucet:ip",
    analytics: true,
  });
}
