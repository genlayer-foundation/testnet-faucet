import assert from "node:assert/strict";
import { test } from "node:test";
import { sendTracked, settlePending } from "../src/lib/tracked-send.ts";

const TO = "0x00000000000000000000000000000000000000aa";
const noSleep = async () => {};

// A fake chain with one faucet wallet. `mode` decides what a broadcast does.
function fakeChain({ mode = "ok" } = {}) {
  const chain = {
    mode,
    minedNonceValue: 7,
    signed: 0,
    broadcasts: [],
    mempool: new Set(),
    receipts: new Map(),
    paid: 0n,
    values: new Map(),
    io: {
      async sign(_to, valueWei) {
        chain.signed += 1;
        const nonce = chain.minedNonceValue + chain.mempool.size;
        const txHash = `0xhash${chain.signed}`;
        const raw = `0xraw${chain.signed}`;
        chain.values.set(raw, { txHash, nonce, valueWei });
        return { raw, txHash, nonce };
      },
      async broadcast(raw) {
        chain.broadcasts.push(raw);
        if (chain.mode === "reject") throw new Error("node said no");
        const tx = chain.values.get(raw);
        if (tx.nonce < chain.minedNonceValue) throw new Error("nonce too low");
        chain.mempool.add(raw);
        if (chain.mode === "timeout-after-accept") {
          throw new Error("request timed out");
        }
      },
      async receipt(txHash) {
        return chain.receipts.get(txHash) ?? null;
      },
      async minedNonce() {
        return chain.minedNonceValue;
      },
    },
    // Mines everything in the mempool, like a block would.
    mine() {
      for (const raw of chain.mempool) {
        const tx = chain.values.get(raw);
        if (tx.nonce !== chain.minedNonceValue) continue;
        chain.receipts.set(tx.txHash, "success");
        chain.paid += tx.valueWei;
        chain.minedNonceValue += 1;
      }
      chain.mempool.clear();
    },
    // Another faucet transaction (a 100 GEN claim) takes the current nonce.
    otherTransactionUsesNonce() {
      chain.mempool.clear();
      chain.minedNonceValue += 1;
    },
  };
  return chain;
}

function store() {
  const s = {
    pending: null,
    record: async (p) => {
      if (s.pending) return "pending";
      s.pending = p;
      return true;
    },
  };
  return s;
}

test("normal send: recorded before broadcast, confirmed once mined", async () => {
  const chain = fakeChain();
  const s = store();
  const realBroadcast = chain.io.broadcast;
  chain.io.broadcast = async (raw) => {
    assert.ok(s.pending, "the record must exist before the broadcast");
    await realBroadcast(raw);
    chain.mine();
  };
  const outcome = await sendTracked(TO, 50n, chain.io, s.record, { sleep: noSleep });
  assert.deepEqual(outcome, { state: "confirmed", txHash: "0xhash1" });
  assert.equal(chain.paid, 50n);
});

test("timeout AFTER the node accepted: never reported as failed, retry does not pay twice", async () => {
  const chain = fakeChain({ mode: "timeout-after-accept" });
  const s = store();
  const first = await sendTracked(TO, 50n, chain.io, s.record, { sleep: noSleep });
  assert.equal(first.state, "unknown");

  chain.mine();

  // The retry finds the record and settles it instead of sending again.
  const second = await settlePending(s.pending, chain.io);
  assert.deepEqual(second, { state: "confirmed", txHash: "0xhash1" });
  assert.equal(chain.signed, 1, "only one transaction was ever signed");
  assert.equal(chain.paid, 50n, "paid exactly once");
});

test("a second send for the same recipient is refused while one is recorded", async () => {
  const chain = fakeChain({ mode: "timeout-after-accept" });
  const s = store();
  await sendTracked(TO, 50n, chain.io, s.record, { sleep: noSleep });
  const again = await sendTracked(TO, 50n, chain.io, s.record, { sleep: noSleep });
  assert.equal(again, "pending");
  chain.mine();
  assert.equal(chain.paid, 50n);
  assert.equal(chain.broadcasts.filter((r) => r === "0xraw2").length, 0);
});

test("node rejected the broadcast: unknown, then re-broadcast of the SAME bytes lands", async () => {
  const chain = fakeChain({ mode: "reject" });
  const s = store();
  const first = await sendTracked(TO, 50n, chain.io, s.record, { sleep: noSleep });
  assert.equal(first.state, "unknown");

  chain.mode = "ok";
  const retry = await settlePending(s.pending, chain.io);
  assert.equal(retry.state, "unknown");
  assert.ok(chain.mempool.has("0xraw1"), "same signed transaction re-broadcast");

  chain.mine();
  assert.equal((await settlePending(s.pending, chain.io)).state, "confirmed");
  assert.equal(chain.signed, 1);
  assert.equal(chain.paid, 50n);
});

test("nonce taken by another transaction: failed only after the safety window", async () => {
  const chain = fakeChain({ mode: "reject" });
  const s = store();
  let clock = 1_000_000;
  const now = () => clock;
  await sendTracked(TO, 50n, chain.io, s.record, { sleep: noSleep, now });
  chain.otherTransactionUsesNonce();

  // The first sighting of "nonce spent, no receipt" is stored, never trusted.
  const onNonceSpent = async (at) => {
    s.pending = { ...s.pending, nonceSpentSeenAt: s.pending.nonceSpentSeenAt ?? at };
  };
  const early = await settlePending(s.pending, chain.io, { now, onNonceSpent });
  assert.equal(early.state, "unknown", "too early to be sure");
  assert.equal(s.pending.nonceSpentSeenAt, clock);

  clock += 5 * 60 * 1000 - 1;
  const still = await settlePending(s.pending, chain.io, { now, onNonceSpent });
  assert.equal(still.state, "unknown", "inside the window");

  clock += 2;
  const late = await settlePending(s.pending, chain.io, { now, onNonceSpent });
  assert.equal(late.state, "failed");
  assert.equal(chain.paid, 0n);
  // The dead transaction was never re-broadcast after its nonce was spent.
  assert.equal(chain.broadcasts.length, 2);
});

test("receipt wins over a spent nonce (our transaction is the one that used it)", async () => {
  const chain = fakeChain({ mode: "timeout-after-accept" });
  const s = store();
  let clock = 0;
  await sendTracked(TO, 50n, chain.io, s.record, { sleep: noSleep, now: () => clock });
  chain.mine();
  clock += 60 * 60 * 1000;
  const outcome = await settlePending(s.pending, chain.io, { now: () => clock });
  assert.equal(outcome.state, "confirmed");
});

test("reverted transaction is a failure", async () => {
  const chain = fakeChain();
  const s = store();
  const realBroadcast = chain.io.broadcast;
  chain.io.broadcast = async (raw) => {
    await realBroadcast(raw);
    chain.receipts.set("0xhash1", "reverted");
  };
  const outcome = await sendTracked(TO, 50n, chain.io, s.record, { sleep: noSleep });
  assert.equal(outcome.state, "failed");
});

test("receipt not visible within the wait: unknown, not failed", async () => {
  const chain = fakeChain();
  const s = store();
  let clock = 0;
  const outcome = await sendTracked(TO, 50n, chain.io, s.record, {
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    waitMs: 5_000,
  });
  assert.equal(outcome.state, "unknown");
});

test("signing failure sends nothing and records nothing", async () => {
  const chain = fakeChain();
  const s = store();
  chain.io.sign = async () => {
    throw new Error("rpc down");
  };
  await assert.rejects(() => sendTracked(TO, 50n, chain.io, s.record));
  assert.equal(s.pending, null);
  assert.equal(chain.broadcasts.length, 0);
});

test("record failure sends nothing", async () => {
  const chain = fakeChain();
  await assert.rejects(() =>
    sendTracked(TO, 50n, chain.io, async () => {
      throw new Error("redis down");
    })
  );
  assert.equal(chain.broadcasts.length, 0);
});

test("lost reply after recording: a retry settles the stored transfer", async () => {
  const chain = fakeChain();
  const s = store();
  await assert.rejects(() =>
    sendTracked(TO, 50n, chain.io, async (pending) => {
      await s.record(pending);
      throw new Error("lost write acknowledgement");
    })
  );
  assert.equal(chain.broadcasts.length, 0);
  assert.equal((await settlePending(s.pending, chain.io)).state, "unknown");
  chain.mine();
  assert.equal((await settlePending(s.pending, chain.io)).state, "confirmed");
  assert.equal(chain.signed, 1);
  assert.equal(chain.paid, 50n);
});

test("signed long ago, mined just now, receipt not served yet: never failed", async () => {
  // The record was stored but not broadcast; the user returns an hour later.
  const chain = fakeChain({ mode: "reject" });
  const s = store();
  let clock = 0;
  const now = () => clock;
  const onNonceSpent = async (at) => {
    s.pending = { ...s.pending, nonceSpentSeenAt: s.pending.nonceSpentSeenAt ?? at };
  };
  await sendTracked(TO, 50n, chain.io, s.record, { sleep: noSleep, now });
  clock += 60 * 60 * 1000;
  chain.mode = "ok";
  assert.equal((await settlePending(s.pending, chain.io, { now, onNonceSpent })).state, "unknown");
  chain.mine();

  // A lagging node: the nonce has moved on but the receipt is not served yet.
  const realReceipt = chain.io.receipt;
  chain.io.receipt = async () => null;
  clock += 1000;
  const lagging = await settlePending(s.pending, chain.io, { now, onNonceSpent });
  assert.equal(lagging.state, "unknown", "a paid grant must not be called failed");

  chain.io.receipt = realReceipt;
  clock += 1000;
  assert.equal((await settlePending(s.pending, chain.io, { now, onNonceSpent })).state, "confirmed");
  assert.equal(chain.paid, 50n);
});

test("without a stored first sighting, a spent nonce never means failed", async () => {
  const chain = fakeChain({ mode: "reject" });
  const s = store();
  let clock = 0;
  const now = () => clock;
  await sendTracked(TO, 50n, chain.io, s.record, { sleep: noSleep, now });
  chain.otherTransactionUsesNonce();
  clock += 24 * 60 * 60 * 1000;
  assert.equal((await settlePending(s.pending, chain.io, { now })).state, "unknown");
});
