// A transfer whose outcome is always knowable.
//
// The transaction is signed locally first, so its hash and nonce are known
// before anything reaches the network. That record is stored BEFORE the
// broadcast. Whatever happens next (timeout, crash, dropped connection), a
// later request can look the hash up and learn what happened instead of
// sending a second transfer.
//
// This file has no imports on purpose: it is plain logic over two small
// interfaces, tested offline in tests/tracked-send.test.mjs.

export interface PendingSend {
  txHash: `0x${string}`;
  /** Nonce of the faucet wallet used by this transaction. */
  nonce: number;
  /** The signed transaction. Re-broadcasting it can never pay twice. */
  raw: `0x${string}`;
  /** Epoch milliseconds when the record was written. */
  createdAt: number;
}

export interface ChainIO {
  /** Build and sign a transfer without broadcasting it. */
  sign(
    to: `0x${string}`,
    valueWei: bigint
  ): Promise<{ raw: `0x${string}`; txHash: `0x${string}`; nonce: number }>;
  broadcast(raw: `0x${string}`): Promise<void>;
  /** Receipt status, or null when the chain has no receipt for the hash. */
  receipt(txHash: `0x${string}`): Promise<"success" | "reverted" | null>;
  /** Number of MINED transactions of the faucet wallet ("latest" nonce). */
  minedNonce(): Promise<number>;
}

export type SendOutcome =
  /** Mined and succeeded: the recipient has the funds. */
  | { state: "confirmed"; txHash: `0x${string}` }
  /** Cannot land any more, or was mined and reverted: nothing was paid. */
  | { state: "failed"; txHash: `0x${string}`; reason: string }
  /** May still land. The caller must NOT send again. */
  | { state: "unknown"; txHash: `0x${string}` };

export interface SettleOptions {
  now?: () => number;
  /**
   * How long after signing we wait before trusting "the nonce was used by a
   * different transaction". Guards against an RPC that reports the new nonce
   * before it can serve the receipt.
   */
  deadAfterMs?: number;
}

export const DEFAULT_DEAD_AFTER_MS = 5 * 60 * 1000;

/**
 * Works out what happened to a stored send. Never creates a new transaction;
 * the only thing it may put on the network is the same signed bytes again.
 */
export async function settlePending(
  pending: PendingSend,
  io: ChainIO,
  options: SettleOptions = {}
): Promise<SendOutcome> {
  const now = options.now ?? Date.now;
  const deadAfterMs = options.deadAfterMs ?? DEFAULT_DEAD_AFTER_MS;
  const { txHash } = pending;

  // Read the nonce BEFORE the receipt: if the nonce is already used, a receipt
  // for our transaction (if it is the one that used it) exists by the time we
  // look for it.
  const minedNonce = await io.minedNonce();
  const receipt = await io.receipt(txHash);

  if (receipt === "success") return { state: "confirmed", txHash };
  if (receipt === "reverted") {
    return { state: "failed", txHash, reason: "transaction reverted" };
  }

  if (minedNonce > pending.nonce) {
    // Our nonce is spent and there is no receipt for our hash: a different
    // transaction took it, so ours can never be mined.
    if (now() - pending.createdAt < deadAfterMs) {
      return { state: "unknown", txHash };
    }
    return {
      state: "failed",
      txHash,
      reason: "nonce was used by another transaction",
    };
  }

  // The nonce is still free, so the signed transaction is still valid. Make
  // sure the network has it. Errors ("already known", timeouts) change nothing.
  try {
    await io.broadcast(pending.raw);
  } catch {
    // outcome stays unknown
  }
  return { state: "unknown", txHash };
}

export interface SendOptions extends SettleOptions {
  /** How long to wait for the receipt after broadcasting. */
  waitMs?: number;
  pollMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Signs, records, broadcasts, then waits briefly for the receipt.
 *
 * `record` must store the pending send durably and return false when another
 * record already exists for the same recipient (then nothing is broadcast and
 * null is returned). If `sign` or `record` throw, nothing was sent.
 */
export async function sendTracked(
  to: `0x${string}`,
  valueWei: bigint,
  io: ChainIO,
  record: (pending: PendingSend) => Promise<boolean>,
  options: SendOptions = {}
): Promise<SendOutcome | null> {
  const now = options.now ?? Date.now;
  const waitMs = options.waitMs ?? 15_000;
  const pollMs = options.pollMs ?? 1_000;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  const signed = await io.sign(to, valueWei);
  const pending: PendingSend = { ...signed, createdAt: now() };

  if (!(await record(pending))) return null;

  // From here on the outcome is never reported as "nothing was sent" unless
  // the chain proves it.
  let broadcastFailed = false;
  try {
    await io.broadcast(pending.raw);
  } catch {
    broadcastFailed = true;
  }

  if (broadcastFailed) {
    // One full check (which also re-broadcasts if the nonce is still free).
    try {
      return await settlePending(pending, io, options);
    } catch {
      return { state: "unknown", txHash: pending.txHash };
    }
  }

  const deadline = now() + waitMs;
  for (;;) {
    try {
      const receipt = await io.receipt(pending.txHash);
      if (receipt === "success") {
        return { state: "confirmed", txHash: pending.txHash };
      }
      if (receipt === "reverted") {
        return {
          state: "failed",
          txHash: pending.txHash,
          reason: "transaction reverted",
        };
      }
    } catch {
      // keep polling until the deadline
    }
    if (now() + pollMs > deadline) break;
    await sleep(pollMs);
  }
  return { state: "unknown", txHash: pending.txHash };
}
