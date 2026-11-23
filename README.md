# GenLayer Testnet Faucet

The official faucet for [GenLayer Bradbury Phase 2](https://www.genlayer.com). Claim free GEN tokens to build and test on the network.

**Live at [testnet-faucet.genlayer.foundation](https://testnet-faucet.genlayer.foundation)**

## Features

- **100 GEN per claim** — enough to get started building
- **Rate limiting** — 1 claim per wallet per 7 days, 1 claim per GitHub account per 7 days, 5 claims per IP per 24h
- **Balance threshold** — wallets with >1,000 GEN are ineligible
- **CAPTCHA protection** — Cloudflare Turnstile to prevent abuse
- **Concurrent safety** — Redis locks per wallet and per GitHub account; limits are re-read inside the locks
- **Validator grant** — a wallet holding at least 1 ETH on Ethereum mainnet can claim 50,000 GEN once, ever (enough for the 42,000 GEN minimum validator stake); once per wallet and per GitHub account; capped per UTC day; off unless `VALIDATOR_GRANT_ENABLED=true`
- **Fair counting** — rate limits only consumed after successful transaction
- **Add network** — one-click MetaMask/wallet integration for Bradbury Phase 2

## Tech Stack

- [Next.js](https://nextjs.org) 16 (App Router, TypeScript)
- [Tailwind CSS](https://tailwindcss.com) v4
- [viem](https://viem.sh) for blockchain interactions
- [Upstash Redis](https://upstash.com) for rate limiting and statistics
- [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) for bot protection
- Deployed on [Vercel](https://vercel.com)

## Network Details

| Parameter | Value |
| --- | --- |
| Network | GenLayer Bradbury Phase 2 |
| Chain ID | 4221 |
| Currency | GEN (18 decimals) |
| RPC | `https://rpc-genlayer-chain-testnet-cfn8m3xc6l.t.conduit.xyz` |
| Explorer | [explorer-genlayer-chain-testnet-cfn8m3xc6l.t.conduit.xyz](https://explorer-genlayer-chain-testnet-cfn8m3xc6l.t.conduit.xyz) |

## Getting Started

### Prerequisites

- Node.js 22.13+ (including the network configuration checks)
- An [Upstash Redis](https://upstash.com) instance
- A [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) site key and secret
- A funded wallet on GenLayer Bradbury Phase 2

### Setup

1. Clone the repo:

```bash
git clone https://github.com/genlayer-foundation/testnet-faucet.git
cd testnet-faucet
```

2. Install dependencies:

```bash
npm install
```

3. Copy the env template and fill in your values:

```bash
cp .env.example .env.local
```

4. Configure environment variables (see below).

5. Start the dev server:

```bash
npm run dev
```

The app will be running at `http://localhost:3000`.

### Environment Variables

| Variable | Description | Required |
| --- | --- | --- |
| `FAUCET_PRIVATE_KEY` | Private key of the funded faucet wallet | Yes |
| `RPC_URL` | Server-only RPC override; defaults to `NEXT_PUBLIC_RPC_URL`. Must target the same rollup. | No |
| `NEXT_PUBLIC_RPC_URL` | Public HTTP(S) RPC used for wallet setup; no credentials | Yes |
| `NEXT_PUBLIC_CHAIN_NAME` | Network name used in the wallet, header, page and metadata | Yes |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key | Yes |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key | Yes |
| `KV_REST_API_URL` | Upstash Redis REST URL | Yes |
| `KV_REST_API_TOKEN` | Upstash Redis REST token | Yes |
| `NEXT_PUBLIC_EXPLORER_URL` | HTTP(S) explorer base URL; trailing slashes are removed | Yes |
| `NEXT_PUBLIC_CHAIN_ID` | Positive integer chain ID (`4221` for Bradbury Phase 2); no fallback | Yes |
| `CLAIM_AMOUNT` | GEN per claim (default: `100`) | No |
| `NEXT_PUBLIC_CLAIM_AMOUNT` | Displayed claim amount (default: `100`) | No |
| `BALANCE_THRESHOLD` | Max recipient balance (default: `1000`) | No |
| `NEXT_PUBLIC_APP_URL` | Canonical URL for metadata | No |
| `ETHEREUM_RPC_URL` | Ethereum mainnet RPC for the ETH balance checks. The 100 GEN claim falls back to a public endpoint when unset; the validator grant refuses | No |
| `VALIDATOR_GRANT_ENABLED` | `true` switches the validator grant on (also needs `ETHEREUM_RPC_URL`). Read at build time for the page: rebuild after changing | No |
| `VALIDATOR_GRANT_AMOUNT` | GEN sent by the validator grant (default: `50000`) | No |
| `VALIDATOR_GRANT_MIN_ETH` | Mainnet ETH a wallet must hold (default: `1`) | No |
| `VALIDATOR_GRANT_DAILY_CAP` | Max validator grants per UTC day across all wallets (default: `20`; `0` switches the grant off) | No |
| `VALIDATOR_GRANT_MIN_TX_COUNT` | Minimum transactions the wallet has sent on mainnet (default: `0`, no requirement) | No |
| `VALIDATOR_GRANT_BALANCE_BLOCK` | `latest` (default) or `finalized`: the mainnet block the balance and transaction count are read at | No |

For local development, Turnstile provides test keys that always pass:

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgenlayer-foundation%2Ftestnet-faucet&env=FAUCET_PRIVATE_KEY,NEXT_PUBLIC_RPC_URL,NEXT_PUBLIC_CHAIN_ID,NEXT_PUBLIC_CHAIN_NAME,NEXT_PUBLIC_EXPLORER_URL,NEXT_PUBLIC_TURNSTILE_SITE_KEY,TURNSTILE_SECRET_KEY,KV_REST_API_URL,KV_REST_API_TOKEN)


### Network migration

Network configuration is validated in `src/lib/chain.ts`. The wallet button,
explorer links, network labels, and metadata all use that configuration. Missing
or invalid public network settings fail validation instead of silently selecting
another chain. Native GEN with 18 decimals remains a transfer assumption.

Set these values in the intended Vercel environment **before rebuilding**:

```dotenv
NEXT_PUBLIC_CHAIN_NAME="GenLayer Bradbury Phase 2"
NEXT_PUBLIC_CHAIN_ID=4221
NEXT_PUBLIC_RPC_URL=https://rpc-genlayer-chain-testnet-cfn8m3xc6l.t.conduit.xyz
NEXT_PUBLIC_EXPLORER_URL=https://explorer-genlayer-chain-testnet-cfn8m3xc6l.t.conduit.xyz
RPC_URL=https://rpc-genlayer-chain-testnet-cfn8m3xc6l.t.conduit.xyz
```

`RPC_URL` is optional, but an existing Vercel override must be updated or removed;
it takes precedence on the server. Public settings are embedded at build time.
Repository changes alone do not update Vercel settings or deploy the migration.

- Keep the existing Redis credentials and keys: cooldowns, statistics and daily-cap
  usage carry over. Do not reset or namespace claim history for this migration.
- Keep `FAUCET_PRIVATE_KEY` if it derives the expected faucet address
  `0x08E9F4723CF5A27866bB11eD2C41162e05206777`. Verify the derived public address
  without displaying the key. The wallet needs native GEN on Orbit plus gas.
- Existing wallet entries using chain ID `4221` may still point at the old zkSync
  chain. Edit their RPC and explorer to the new values; accepting “Add network”
  does not prove the wallet replaced an existing endpoint. Select the updated
  network to see the new balance.
- This configuration funds one rollup. It does not independently route claims to
  Asimov. GitHub, CAPTCHA, Ethereum mainnet ETH checks, and claim amounts are unchanged.
- No consensus ABI/address, bridge integration, or WebSocket client is required.

See the [migration skill](.agents/skills/migrate-faucet-network/SKILL.md) for the
full change map and the [deployment reference](.agents/skills/migrate-faucet-network/references/bradbury-phase-2.md)
for chain identity, funding links and epoch reads.

### Checks

With the public network settings from `.env.example` configured in `.env.local`:

```bash
npm run test:network
npm run test:send
npm run lint
npm run build
```

The network tests run offline with isolated example configuration. After an
approved rollout, verify a real claim's receipt, recipient balance increase,
explorer link and retained cooldowns. A returned transaction hash alone does not
confirm mining. Do not use production Redis for local claim tests.

## API

### `POST /api/claim`

Request a token claim.

```json
{
  "address": "0x...",
  "turnstileToken": "..."
}
```

**Success (200):**
```json
{
  "success": true,
  "txHash": "0x...",
  "explorerUrl": "https://explorer-genlayer-chain-testnet-cfn8m3xc6l.t.conduit.xyz/tx/0x..."
}
```

**Rate limited (429):**
```json
{
  "success": false,
  "error": "This address has already claimed GEN in the last 7 days.",
  "retryAfter": 43200
}
```

### `POST /api/validator-grant`

One-time grant for validators. Same request body as `/api/claim`, same GitHub session. The address must hold at least `VALIDATOR_GRANT_MIN_ETH` native ETH on Ethereum mainnet; the GEN is sent to that same address.

**Success (200):** the transfer is mined.
```json
{
  "success": true,
  "txHash": "0x...",
  "explorerUrl": "https://.../tx/0x...",
  "amount": "50000"
}
```

**Not confirmed yet (202):** the transfer was signed and recorded but no receipt was seen. It is not a failure. Sending the same request again reports the outcome of that same transaction and never creates a second one.
```json
{
  "success": false,
  "pending": true,
  "txHash": "0x...",
  "explorerUrl": "https://.../tx/0x...",
  "amount": "50000",
  "error": "Your grant was submitted but is not confirmed yet. ..."
}
```

**Refusals** (`{ "success": false, "error": "..." }`):

| Status | Meaning |
| --- | --- |
| 400 | Invalid address or failed CAPTCHA |
| 401 | Not signed in with GitHub |
| 403 | Less than the minimum ETH (or transactions) on mainnet |
| 409 | Wallet already received the grant, GitHub account already used for another wallet, or a request is in progress |
| 429 | IP limit reached, or today's global cap of grants is used up |
| 502 | Nothing was sent: the transfer could not be prepared, or an earlier one is proven dead |
| 503 | Grant switched off, mainnet could not be read, or faucet balance too low |

### `GET /api/stats`

Public statistics endpoint (cached for 30s).

```json
{
  "totalClaims": 1234,
  "uniqueAddresses": 567
}
```

## Security

The claim flow performs the following checks in order:

1. Input validation (valid Ethereum address format)
2. Cloudflare Turnstile CAPTCHA verification
3. IP rate limit check (5 per 24h)
4. Address rate limit check (1 per 7 days)
5. Recipient balance threshold check (<1,000 GEN)
6. Redis lock acquisition for the wallet and the GitHub account, then the wallet and GitHub limits are read again inside the locks
7. Faucet balance check (sufficient funds)
8. Transaction send
9. Rate limit and stats recorded (only on success)
10. Lock release

### Validator grant

`POST /api/validator-grant` runs: input validation, "is the grant on", GitHub session, Turnstile, the shared IP limit (a grant counts as one of the 5 per 24h), the once-ever wallet key, the once-ever GitHub key, the global daily cap, the mainnet read, Redis locks for the wallet and the GitHub account, a re-check of the once-ever keys, an atomic daily slot reservation, the faucet balance check, then the send. The 1,000 GEN balance threshold and the 100 GEN daily cap do not apply to this path.

**No double payment.** The transfer is signed locally first, so its hash and nonce are known before anything is broadcast. That record (`faucet:vgrant:pending:<wallet>`) is written to Redis before the broadcast and removed only when the outcome is proven (`src/lib/tracked-send.ts`):

- receipt with success: the permanent wallet key is written, then the record is removed;
- receipt reverted, or the faucet nonce was used by a different transaction and five minutes have passed: nothing was paid, the record, the daily slot and the GitHub key are released and the wallet may try again;
- anything else (timeout, dropped connection, not mined yet): the wallet stays "pending". A new request only looks the hash up, and re-broadcasts the same signed bytes if the nonce is still free. It never signs a second transfer.

It fails closed: if `ETHEREUM_RPC_URL` is unset, errors, times out (8s) or is not chain id 1, nothing is sent. The 100 GEN claim does not depend on the grant being on.

Known limits: the grant checks a balance, not a person. The same ETH can be moved to a fresh wallet and claimed again with another GitHub account, so `VALIDATOR_GRANT_DAILY_CAP` is what bounds the total given out per day. The 100 GEN claim still uses a plain send: if its RPC call times out after the broadcast, the claim is reported as failed and can be repeated.

## License

MIT
