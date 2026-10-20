# Bradbury Phase 2 target

Updated 2026-10-19. Repository code now reads required public network environment
variables; `.env.example` targets this deployment. Vercel settings have not been
inspected or changed, and no production rollout or live claim has been performed.

## Target configuration

```dotenv
NEXT_PUBLIC_CHAIN_NAME="GenLayer Bradbury Phase 2"
NEXT_PUBLIC_RPC_URL=https://rpc-genlayer-chain-testnet-cfn8m3xc6l.t.conduit.xyz
RPC_URL=https://rpc-genlayer-chain-testnet-cfn8m3xc6l.t.conduit.xyz
NEXT_PUBLIC_CHAIN_ID=4221
NEXT_PUBLIC_EXPLORER_URL=https://explorer-genlayer-chain-testnet-cfn8m3xc6l.t.conduit.xyz
```

- Network: Bradbury Phase 2 on Arbitrum Orbit; native GEN, 18 decimals.
- WebSocket (not used by the faucet): `wss://rpc-genlayer-chain-testnet-cfn8m3xc6l.t.conduit.xyz`.
- [Funding bridge](https://genlayer-chain-testnet-cfn8m3xc6l-86e44e69a1216817.testnets.rollbridge.app/).
- [Sepolia GEN token](https://sepolia.etherscan.io/address/0x424242424b68330CcFb022881d25a6acC29852ea#readProxyContract): L1 token, not an ERC-20 integration to add to this faucet.
- [Pinned manifest](https://github.com/genlayerlabs/genlayer-consensus/blob/4e5bacaa43857e2c183d7b32b32fb75c2161dc93/deployments/bradbury-phase-2.json).
- [Phase 2 runbook](https://github.com/genlayerlabs/genlayer-consensus/blob/4e5bacaa43857e2c183d7b32b32fb75c2161dc93/docs/deployment/bradbury-phase-2-runbook.md).
- [Orbit/token details](https://github.com/genlayerlabs/genlayer-consensus/blob/4e5bacaa43857e2c183d7b32b32fb75c2161dc93/docs/deployment/genlayer-orbit-testnet.md).

The manifest was accessible through authenticated `gh api` even when public GitHub
fetches returned 404. Read the pinned revision; do not substitute a moving branch.

## Chain identity

Observed on 2026-10-16: both chains report `4221` (`0x107d`), but differ in genesis.

| Chain | Genesis hash |
| --- | --- |
| Old RPC `https://zksync-os-testnet-genlayer.zksync.dev` | `0xef97917ce9bd9fa7d12ad6a8d81ea26c80ac1d727acc37cbb9799ae199788dc5` |
| Target Orbit RPC | `0x17d89764d4f4f963158fc4c5e8f2cb670c2837740b35f37081c12860c3df97e4` |

The Phase 2 runbook reuses an existing **Orbit** rollup, not the old zkSync chain.
Carry over Redis claim history as instructed, but verify funding on Orbit separately.
The repository configures a single rollup and no longer advertises separate
Asimov funding. The intended faucet wallet is
`0x08E9F4723CF5A27866bB11eD2C41162e05206777`; its native Orbit balance was
110,000,000 GEN when checked on 2026-10-19. Recheck before rollout. The address
derived from Vercel's `FAUCET_PRIVATE_KEY` has not been verified; retain the key
if it derives this address. Keep existing Redis credentials and history.

## Read the current epoch

Staking in this pinned manifest: `0xD8fBa96C0dBB0257028dBc0107060b958e5c7113`.
This address is for optional operational reads, not a new faucet dependency.

```bash
cast call 0xD8fBa96C0dBB0257028dBc0107060b958e5c7113 \
  'epoch()(uint256)' \
  --rpc-url https://rpc-genlayer-chain-testnet-cfn8m3xc6l.t.conduit.xyz
```

For a reproducible observation, obtain `cast block-number` from this RPC and pass
that number using `--block` to the call. Record the UTC check time too.
At block 48,535 on 2026-10-16 at 15:43 UTC, `epoch()` was `0`,
`inflationInitDone()` was `true`, and `inflationEpoch()` was `15`.
These are historical observations: read again for current status.
`inflationEpoch()` is the funding horizon, not the active epoch.
No epoch condition currently gates faucet claims; do not add one unless requested.
