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

/**
 * Ties the GitHub account to this wallet, once. Returns false when the account
 * is already tied to a different wallet.
 */
export async function claimGitHubGrant(
  githubUserId: string,
  address: string
): Promise<boolean> {
  const redis = getRedis();
  const key = `${GH_PREFIX}${githubUserId}`;
  const set = await redis.set(key, address, { nx: true });
  if (set) return true;
  return (await redis.get<string>(key)) === address;
}

export async function releaseGitHubGrant(githubUserId: string): Promise<void> {
  await getRedis().del(`${GH_PREFIX}${githubUserId}`);
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

/** Written before the broadcast. False when a record already exists. */
export async function recordPendingGrant(
  address: string,
  pending: PendingGrant
): Promise<boolean> {
  const set = await getRedis().set(`${PENDING_PREFIX}${address}`, pending, {
    nx: true,
  });
  return Boolean(set);
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

// --- global daily cap --------------------------------------------------------

function dailyKey(): string {
  return `${DAILY_PREFIX}${new Date().toISOString().split("T")[0]}`; // UTC day
}

export async function getGrantsToday(): Promise<number> {
  return (await getRedis().get<number>(dailyKey())) ?? 0;
}

/**
 * Atomically takes one of today's grant slots. Returns the key to hand back to
 * releaseDailySlot if the send fails, or null when the cap is reached.
 */
export async function reserveDailySlot(cap: number): Promise<string | null> {
  const redis = getRedis();
  const key = dailyKey();
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, DAILY_TTL_SECONDS);
  if (count > cap) {
    await redis.decr(key);
    return null;
  }
  return key;
}

export async function releaseDailySlot(key: string): Promise<void> {
  await getRedis().decr(key);
}
