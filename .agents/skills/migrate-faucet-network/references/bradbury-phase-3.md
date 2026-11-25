# Bradbury Phase 3 target

Written 2026-11-25. Repository files (`.env.example`, `README.md`) name this deployment.
Vercel settings have not been changed and no production rollout or live claim has been
performed: the live site still said "Bradbury Phase 2" when this was written.

## What Phase 3 is, for the faucet

Bradbury Phase 3 is a new **consensus deployment** (release `v0.6.0`, deployed 2026-11-24) on
the **same rollup** as Phase 2: the Arbitrum Orbit chain with chain ID `4221`, the same RPC,
explorer and bridge, and native GEN with 18 decimals. Deployments on this rollup are told
apart only by contract address.

The faucet sends native GEN and reads native balances. It calls no consensus contract, so the
only thing that changes is the **network name**:

```dotenv
NEXT_PUBLIC_CHAIN_NAME="GenLayer Bradbury Phase 3"
```

Everything else stays as it is: `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `RPC_URL`,
`NEXT_PUBLIC_EXPLORER_URL`, `FAUCET_PRIVATE_KEY`, the Redis credentials and keys (claim history
carries over, as decided on 2026-10-18), claim amounts and eligibility. `NEXT_PUBLIC_*` values
are embedded at build time, so the name change needs a redeploy.

Checked with `git grep` on 2026-11-25: no source file under `src/`, `public/` or `tests/`
names a phase or holds a consensus address. The only addresses in the repository are the
expected faucet wallet and, in the Phase 2 reference, the Phase 2 Staking address and the L1
GEN token.

## Chain identity (unchanged)

Observed on 2026-11-25 at 14:44 UTC, block 706183. Both hosts are the same chain:

| RPC | Chain ID | Genesis hash |
| --- | --- | --- |
| `https://rpc-genlayer-chain-testnet-cfn8m3xc6l.t.conduit.xyz` | `4221` | `0x17d89764d4f4f963158fc4c5e8f2cb670c2837740b35f37081c12860c3df97e4` |
| `https://rpc.testnet-chain.genlayer.com` | `4221` | `0x17d89764d4f4f963158fc4c5e8f2cb670c2837740b35f37081c12860c3df97e4` |

Because the rollup is the same, wallets need no RPC or explorer edit for this migration, and
balances are the same balances. The expected faucet wallet
`0x08E9F4723CF5A27866bB11eD2C41162e05206777` held 82,584,688 GEN at that block. The address
derived from Vercel's `FAUCET_PRIVATE_KEY` has not been verified.

## Deployment facts

- Source of truth: `genlayerlabs/genlayer-networks`, folder `bradbury-phase-3/` (`README.md`,
  `testnet_deployments.json`, `abi/`), read through authenticated `gh api`.
- Staking: `0xcE16862EAf10B97A0619BeBb662991fb4a52e346`. Not a faucet dependency; for
  optional operational reads only:

```bash
cast call 0xcE16862EAf10B97A0619BeBb662991fb4a52e346 'epoch()(uint256)' \
  --rpc-url https://rpc.testnet-chain.genlayer.com
```

  At block 706183 `epoch()` was `2` and `validatorMinStake()` was 42,000 GEN. Epochs after
  epoch 0 last 1 day. These are observations: read again for current status.

## Validator stake and the faucet

Joining Phase 3 as a validator needs 42,000 GEN. A claim is 100 GEN per wallet and per GitHub
account every 7 days, and a wallet holding more than 1,000 GEN cannot claim, so the faucet
cannot fund a validator. The validator grant was removed on 2026-11-25. How validators get
their stake is a decision outside this repository; do not change amounts or add a grant here
unless requested.
