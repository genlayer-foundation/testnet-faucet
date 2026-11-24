import { createPublicClient, http, parseEther, type PublicClient } from "viem";
import { mainnet } from "viem/chains";
import { getRedis } from "./redis";
import type { PendingSend } from "./tracked-send";

// One-time validator grant: a wallet holding at least VALIDATOR_GRANT_MIN_ETH
// on Ethereum mainnet can claim VALIDATOR_GRANT_AMOUNT GEN once, forever.
// Off unless VALIDATOR_GRANT_ENABLED=true.

const GRANTED_PREFIX = "faucet:vgrant:addr:"; // permanent, no TTL
const GH_PREFIX = "faucet:vgrant:gh:"; // permanent, no TTL
const PENDING_PREFIX = "faucet:vgrant:pending:"; // kept until the outcome is known
const LOCK_PREFIX = "lock:vgrant:";
const DAILY_PREFIX = "faucet:vgrant:daily:";
const DAILY_TTL_SECONDS = 172800; // counters are only read on their own day
const NONCE_SPENT_PREFIX = "faucet:vgrant:noncespent:"; // by tx hash
const NONCE_SPENT_TTL_SECONDS = 2592000; // 30 days, far longer than any retry
const LOCK_TTL_SECONDS = 120;
const MAINNET_TIMEOUT_MS = 8000;

const DEFAULT_AMOUNT = "50000";
const DEFAULT_MIN_ETH = "1";
const DEFAULT_DAILY_CAP = 100;

function positiveDecimal(raw: string | undefined, fallback: string): string {
  const value = raw?.trim();
  if (value && /^\d+(\.\d+)?$/.test(value) && Number(value) > 0) return value;
  return fallback;
}

function nonNegativeInt(raw: string | undefined, fallback: number): number {
  const value = raw?.trim();
  return value && /^\d+$/.test(value) ? Number(value) : fallback;
}

export function getGrantConfig() {
  const amount = positiveDecimal(
    process.env.VALIDATOR_GRANT_AMOUNT,
    DEFAULT_AMOUNT
  );
  const minEth = positiveDecimal(
    process.env.VALIDATOR_GRANT_MIN_ETH,
    DEFAULT_MIN_ETH
  );
  // 0 is a valid value: it switches the grant off.
  const dailyCap = nonNegativeInt(
    process.env.VALIDATOR_GRANT_DAILY_CAP,
    DEFAULT_DAILY_CAP
  );
  // Optional anti-farming extras, both off by default.
  const minTxCount = nonNegativeInt(process.env.VALIDATOR_GRANT_MIN_TX_COUNT, 0);
  const balanceBlock: "latest" | "finalized" =
    process.env.VALIDATOR_GRANT_BALANCE_BLOCK?.trim() === "finalized"
      ? "finalized"
      : "latest";

  return {
    amount,
    amountWei: parseEther(amount),
    minEth,
    minEthWei: parseEther(minEth),
    dailyCap,
    minTxCount,
    balanceBlock,
  };
}

/** The grant is offered only when switched on AND a mainnet RPC is configured. */
export function isGrantEnabled(): boolean {
  return (
    process.env.VALIDATOR_GRANT_ENABLED?.trim() === "true" &&
    Boolean(process.env.ETHEREUM_RPC_URL?.trim()) &&
    getGrantConfig().dailyCap > 0
  );
}

let mainnetClient: PublicClient | null = null;
let mainnetClientUrl: string | null = null;
let mainnetChainVerified = false;

/**
 * Native ETH balance and sent-transaction count on Ethereum mainnet, read at
 * the configured block. Throws when the RPC is unset, unreachable, slow, or is
 * not chain id 1 - callers must treat a throw as "refuse the grant". Unlike the
 * 100 GEN claim there is no public-endpoint fallback here.
 */
export async function getMainnetStanding(
  address: `0x${string}`
): Promise<{ balanceWei: bigint; txCount: number }> {
  const url = process.env.ETHEREUM_RPC_URL?.trim();
  if (!url) throw new Error("ETHEREUM_RPC_URL not configured");

  if (!mainnetClient || mainnetClientUrl !== url) {
    mainnetClient = createPublicClient({
      chain: mainnet,
      transport: http(url, { timeout: MAINNET_TIMEOUT_MS, retryCount: 1 }),
    });
    mainnetClientUrl = url;
    mainnetChainVerified = false;
  }

  // A testnet RPC pasted into the env var must not hand out grants.
  if (!mainnetChainVerified) {
    const chainId = await mainnetClient.getChainId();
    if (chainId !== mainnet.id) {
      throw new Error(`ETHEREUM_RPC_URL is chain ${chainId}, expected 1`);
    }
    mainnetChainVerified = true;
  }

  const { balanceBlock, minTxCount } = getGrantConfig();
  const [balanceWei, txCount] = await Promise.all([
    mainnetClient.getBalance({ address, blockTag: balanceBlock }),
    minTxCount > 0
      ? mainnetClient.getTransactionCount({ address, blockTag: balanceBlock })
      : Promise.resolve(0),
  ]);
  return { balanceWei, txCount };
}

// --- once-ever markers -------------------------------------------------------

export async function hasReceivedGrant(address: string): Promise<boolean> {
  return (await getRedis().exists(`${GRANTED_PREFIX}${address}`)) > 0;
}

/** Permanent marker. Retried: losing this write would leave the send pending. */
export async function recordGrant(
  address: string,
  txHash: string,
  githubUserId: string
): Promise<void> {
  const redis = getRedis();
  const value = { txHash, githubUserId, at: new Date().toISOString() };
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await redis.set(`${GRANTED_PREFIX}${address}`, value);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Which wallet a GitHub account has used (or is using) for its one grant. */
export async function getGitHubGrantAddress(
  githubUserId: string
): Promise<string | null> {
  return getRedis().get<string>(`${GH_PREFIX}${githubUserId}`);
}

// --- pending sends -----------------------------------------------------------

export interface PendingGrant extends PendingSend {
  githubUserId: string;
  /** Daily counter key holding this grant's slot. */
  slotKey: string;
}

export async function getPendingGrant(
  address: string
): Promise<PendingGrant | null> {
  return getRedis().get<PendingGrant>(`${PENDING_PREFIX}${address}`);
}

type ReservationResult = "reserved" | "pending" | "granted" | "github_used" | "cap_reached";

// The pending bytes and both reservations must survive a lost Redis reply together.
// The Redis client retries a request whose reply was lost: a replay after a
// committed EVAL finds its own record (same bytes), consumes no second slot and
// is told "reserved" again, so the broadcast still happens in this request.
export async function reservePendingGrant(
  address: string,
  pending: PendingGrant,
  cap: number
) {
  const result = await getRedis().eval<[string, string, number, number], ReservationResult>(
    `if redis.call("EXISTS", KEYS[4]) == 1 then return "granted" end
     local existing = redis.call("GET", KEYS[1])
     if existing then
       if existing == ARGV[2] then return "reserved" end
       return "pending"
     end
     local wallet = redis.call("GET", KEYS[2])
     if wallet and wallet ~= ARGV[1] then return "github_used" end
     local used = tonumber(redis.call("GET", KEYS[3]) or "0")
     if used >= tonumber(ARGV[3]) then return "cap_reached" end

     if redis.call("INCR", KEYS[3]) == 1 then
       redis.call("EXPIRE", KEYS[3], ARGV[4])
     end
     redis.call("SET", KEYS[2], ARGV[1])
     redis.call("SET", KEYS[1], ARGV[2])
     return "reserved"`,
    [
      `${PENDING_PREFIX}${address}`,
      `${GH_PREFIX}${pending.githubUserId}`,
      pending.slotKey,
      `${GRANTED_PREFIX}${address}`,
    ],
    [address, JSON.stringify(pending), cap, DAILY_TTL_SECONDS]
  );
  return result === "reserved" ? true as const : result;
}

/** Release only the failed send's reservation, even if Redis retries the command. */
export async function releaseFailedGrant(
  address: string,
  txHash: string,
  grant: Pick<PendingGrant, "githubUserId" | "slotKey">
): Promise<void> {
  await getRedis().eval(
    // Plain substring match on the stored JSON (no cjson dependency).
    `local raw = redis.call("GET", KEYS[1])
     if not raw or not string.find(raw, '"txHash":"' .. ARGV[1] .. '"', 1, true) then return 0 end
     if redis.call("EXISTS", KEYS[3]) == 1 then redis.call("DECR", KEYS[3]) end
     if redis.call("GET", KEYS[2]) == ARGV[2] then redis.call("DEL", KEYS[2]) end
     return redis.call("DEL", KEYS[1])`,
    [`${PENDING_PREFIX}${address}`, `${GH_PREFIX}${grant.githubUserId}`, grant.slotKey],
    [txHash, address]
  );
}

/** When a check first saw this transaction's nonce spent with no receipt. */
export async function getNonceSpentSeenAt(
  txHash: string
): Promise<number | undefined> {
  const at = await getRedis().get<number>(`${NONCE_SPENT_PREFIX}${txHash}`);
  return typeof at === "number" ? at : undefined;
}

/** First observation wins; later calls change nothing. */
export async function markNonceSpentSeen(
  txHash: string,
  at: number
): Promise<void> {
  await getRedis().set(`${NONCE_SPENT_PREFIX}${txHash}`, at, {
    nx: true,
    ex: NONCE_SPENT_TTL_SECONDS,
  });
}

export async function clearPendingGrant(address: string): Promise<void> {
  await getRedis().del(`${PENDING_PREFIX}${address}`);
}

// --- locks -------------------------------------------------------------------

export async function acquireGrantLock(id: string): Promise<boolean> {
  const acquired = await getRedis().set(`${LOCK_PREFIX}${id}`, "1", {
    nx: true,
    ex: LOCK_TTL_SECONDS,
  });
  return Boolean(acquired);
}

export async function releaseGrantLock(id: string): Promise<void> {
  await getRedis().del(`${LOCK_PREFIX}${id}`);
}

const SIGNER_LOCK_ID = "signer";

/**
 * One grant at a time may sign and broadcast: two grants signing together
 * would pick the same nonce and one would be stuck until proven dead. Waits
 * briefly for the lock; false means "busy, try again".
 */
export async function acquireSignerLock(
  waitMs = 20_000,
  pollMs = 500
): Promise<boolean> {
  const deadline = Date.now() + waitMs;
  for (;;) {
    if (await acquireGrantLock(SIGNER_LOCK_ID)) return true;
    if (Date.now() + pollMs > deadline) return false;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}

export async function releaseSignerLock(): Promise<void> {
  await releaseGrantLock(SIGNER_LOCK_ID);
}

// --- global daily cap --------------------------------------------------------

export function dailyKey(): string {
  return `${DAILY_PREFIX}${new Date().toISOString().split("T")[0]}`; // UTC day
}

export async function getGrantsToday(): Promise<number> {
  return (await getRedis().get<number>(dailyKey())) ?? 0;
}
