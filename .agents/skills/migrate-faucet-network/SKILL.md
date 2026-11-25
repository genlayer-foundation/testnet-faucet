---
name: migrate-faucet-network
description: Map or implement this faucet's chain/network migration, including RPC and explorer settings, Vercel configuration, wallet setup, funding, and verification. Use when switching networks or assessing a new Bradbury deployment.
---

# Migrate the faucet network

Centralize migration work here. Paths below are relative to the repository root.
For Bradbury Phase 3 (current: a new consensus deployment on the same rollup, so only the
name changes), read [its reference](references/bradbury-phase-3.md). For Bradbury Phase 2
(the move from zkSync to the Orbit rollup), read [the deployment reference](references/bradbury-phase-2.md).
For another target, obtain its deployment details and update/add the relevant reference;
do not silently reuse Bradbury addresses or chain identity.

## Scope and standing decisions

- **Carry over claim history.** The user explicitly chose this on 2026-10-18.
  Preserve the existing Redis database, credentials, key names, TTLs, counters,
  statistics, daily-cap usage, and processing locks. Do not flush Redis, switch
  databases, reset cooldowns, or introduce a network namespace unless the user
  explicitly changes this decision. Existing users may remain rate-limited after
  the cutover; this is intended. TTLs continue to expire normally.
- Keep claim amounts, eligibility thresholds, GitHub authentication, Turnstile,
  and Ethereum mainnet ETH checks unchanged unless requested. The settlement
  chain moving to Sepolia does not move the mainnet anti-abuse check to Sepolia.
- Match the requested scope: mapping is read-only; implementing a migration does
  not by itself authorize funding transfers, live claims, or production deployment.
  Honor authorization already given; do not repeatedly request it.

## Understand the target

Establish HTTP RPC, chain ID, explorer, native symbol/decimals, whether the L2
and balances change, and whether the faucet replaces or retains old-network support.
Read the pinned deployment manifest/runbook when provided. Distinguish documented
configuration, live observations, and unknown production settings.

This app sends native GEN with `viem.sendTransaction({ to, value })` and reads
native balances with `getBalance`. It does not call consensus/staking contracts,
use a GenLayer SDK, bridge funds, or use WebSockets. New consensus addresses alone
require no transfer-code changes. An L1 ERC-20 token address is not an L2 transfer
destination. Revisit `parseEther`/`formatEther` and balance checks only if the
native-token model or decimals change.

Compare old and new genesis hashes when a chain ID is reused: matching
`eth_chainId` does not establish the same chain or shared balances. Old-network
balances do not establish new-network funding. Never use the old chain as a
fallback transport for a distinct replacement chain.

## Repository change map

Recheck these files before editing; network settings now come from validated environment variables in `src/lib/chain.ts`.
Search tracked files for old hostnames, chain IDs, names, and `process.env` uses
(`rg`, or `git grep` if unavailable) to catch additional copies.

| File | Migration responsibility |
| --- | --- |
| `src/lib/chain.ts` | Required public chain ID/name, RPC and explorer configuration; native GEN/18-decimal assumption. No network fallback values. |
| `src/lib/faucet.ts` | Both clients use `RPC_URL` or the public RPC when absent; signer uses `FAUCET_PRIVATE_KEY`. Native transfer/balance logic normally stays unchanged. Clients/account are cached in-process. |
| `src/components/add-network-button.tsx` | Receives public wallet parameters from the page, derived from `getGenlayerChain()`. Includes existing-wallet RPC/explorer instructions. Never pass the private server RPC. |
| `src/app/api/claim/route.ts` | Honeypot and actual success links both use the configured explorer and append `/tx/<hash>`. Preserve claim checks and lock key. |
| `src/components/footer.tsx` | Receives the configured explorer from the page; bridge link only if requested/useful. |
| `src/components/header.tsx` | Receives the configured network name from the page; this label is not a health check. |
| `src/app/page.tsx`, `src/app/layout.tsx` | Page and metadata use the configured network name and displayed claim amount. |
| `.env.example`, `README.md` | Network values, explorer examples, funding and existing-wallet migration instructions. |
| `src/lib/redis.ts`, `src/lib/rate-limit.ts`, `src/lib/stats.ts` | Preserve connection and key conventions to carry over claim history. No migration/reset needed. |

`NEXT_PUBLIC_RPC_URL` is required for public wallet setup. `RPC_URL` is an optional
server override: when present, update it too so the server and wallet target the
same rollup. Never expose a private provider credential in public configuration.
Required public settings fail validation rather than falling back to another chain.

If the replacement reuses the chain ID, provide instructions to edit the existing
wallet network's RPC/explorer. A successful `wallet_addEthereumChain` request or
chain-ID check does not prove the endpoint was replaced. Test an existing wallet
entry as well as a fresh setup.

The app currently has one destination, with no network selector. Do not promise
continued Asimov support after redirecting all claims. Keeping two distinct chains
requires explicit scope: destination selection/validation, separate clients and
explorer links, and an agreed shared-history policy. Do not infer this feature
from historical dual-network labels.

## Vercel and funding

| Setting/action | Treatment |
| --- | --- |
| `RPC_URL` | Update the existing server override to the target HTTP RPC, or remove it to use the public RPC. |
| `NEXT_PUBLIC_RPC_URL` | Required public HTTP(S) RPC for wallet setup; no credentials. |
| `NEXT_PUBLIC_CHAIN_NAME` | Required display name used by wallet setup, header, page and metadata. |
| `NEXT_PUBLIC_CHAIN_ID` | Set/retain the target decimal chain ID. |
| `NEXT_PUBLIC_EXPLORER_URL` | Set target explorer without trailing slash. |
| `FAUCET_PRIVATE_KEY` | Retain unless a different signer is requested; verify its address has native funds on the target, including gas. Never print the key. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Retain existing values so history carries over. |
| Auth, CAPTCHA, mainnet ETH RPC and eligibility settings | Retain for a chain-only migration. |

Inspect the intended Vercel project/environment when access is available; do not
claim deployed values match `.env.example`. Keep local/preview experiments from
writing production claim history. If the application domain also changes, review
`NEXT_PUBLIC_APP_URL`, `ALLOWED_HOSTNAME`, Turnstile allowed domains, and GitHub
OAuth callbacks separately.

Funding is an on-chain operation outside Vercel. A bridge can fund the L2 signer;
the faucet does not need automatic bridge integration. Confirm the target wallet
balance rather than assuming old balances migrated.

Set environment variables before building and deploy code/settings together:
Next.js embeds `NEXT_PUBLIC_*` values at build time. Redeployment also refreshes
the cached clients/account. Capture previous non-secret settings and deployment
identity for rollback; reverting code alone may leave the new RPC configured.
Rollback must preserve Redis history too.

## Verification and delivery

1. Read chain ID, genesis block, latest block, native balance, and gas estimate
   from the target RPC. For an epoch question, use the target deployment's Staking
   address/getter; report block/time and distinguish current epoch from funding horizon.
2. For code changes, run `npm run test:network`, `npm run lint` and `npm run build` with the intended
   configuration; do not submit claims or write production Redis during checks.
   Documentation-only changes need skill/link validation, not an app build.
3. Verify wallet parameters, old-entry migration instructions, and explorer
   transaction links. Confirm a pre-existing cooldown survives the cutover using
   read-only evidence where possible; do not reset it to facilitate testing.
4. When a live smoke claim is authorized, use an eligible test recipient. Check
   the mined receipt and actual balance increase, then the normal rate-limit/stats
   recording. `sendGEN` currently returns a hash without awaiting a receipt;
   the UI's success message alone is insufficient. A stats endpoint returning
   zeros is also insufficient: its catch branch returns zeros on backend failure.
   Do not blindly resend an ambiguous transaction; inspect its hash/receipt first.
5. Report code changes, deployment settings, funding status, history preservation,
   and verification evidence separately. Identify any unverified production step.
   Refresh the target reference when a migration is actually completed; never
   describe a proposed target as deployed based only on documentation edits.
