# GenLayer Testnet Faucet

The official faucet for [GenLayer Testnet Asimov](https://www.genlayer.com). Claim free GEN tokens to build and test on the network.

**Live at [testnet-faucet.genlayer.foundation](https://testnet-faucet.genlayer.foundation)**

## Features

- **100 GEN per claim** — enough to get started building
- **Rate limiting** — 1 claim per wallet per 24h, 5 claims per IP per 24h
- **Balance threshold** — wallets with >1,000 GEN are ineligible
- **CAPTCHA protection** — Cloudflare Turnstile to prevent abuse
- **Concurrent safety** — Redis-based locking prevents double-sends
- **Fair counting** — rate limits only consumed after successful transaction
- **Add network** — one-click MetaMask/wallet integration for Testnet Asimov

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
| Network | GenLayer Testnet Asimov |
| Chain ID | 4221 |
| Currency | GEN (18 decimals) |
| RPC | `https://zksync-os-testnet-genlayer.zksync.dev` |
| Explorer | [explorer-asimov.genlayer.com](https://explorer-asimov.genlayer.com) |

## Getting Started

### Prerequisites

- Node.js 18+
- An [Upstash Redis](https://upstash.com) instance
- A [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) site key and secret
- A funded wallet on GenLayer Testnet Asimov

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
| `RPC_URL` | GenLayer Testnet RPC endpoint | Yes |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key | Yes |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key | Yes |
| `KV_REST_API_URL` | Upstash Redis REST URL | Yes |
| `KV_REST_API_TOKEN` | Upstash Redis REST token | Yes |
| `NEXT_PUBLIC_EXPLORER_URL` | Block explorer URL | No |
| `NEXT_PUBLIC_CHAIN_ID` | Chain ID (default: `4221`) | No |
| `CLAIM_AMOUNT` | GEN per claim (default: `100`) | No |
| `NEXT_PUBLIC_CLAIM_AMOUNT` | Displayed claim amount (default: `100`) | No |
| `BALANCE_THRESHOLD` | Max recipient balance (default: `1000`) | No |
| `NEXT_PUBLIC_APP_URL` | Canonical URL for metadata | No |

For local development, Turnstile provides test keys that always pass:

```
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgenlayer-foundation%2Ftestnet-faucet&env=FAUCET_PRIVATE_KEY,RPC_URL,NEXT_PUBLIC_TURNSTILE_SITE_KEY,TURNSTILE_SECRET_KEY,KV_REST_API_URL,KV_REST_API_TOKEN)

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
  "explorerUrl": "https://explorer-asimov.genlayer.com/tx/0x..."
}
```

**Rate limited (429):**
```json
{
  "success": false,
  "error": "This address has already claimed GEN in the last 24 hours.",
  "retryAfter": 43200
}
```

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
4. Address rate limit check (1 per 24h)
5. Recipient balance threshold check (<1,000 GEN)
6. Redis lock acquisition (prevents concurrent claims)
7. Faucet balance check (sufficient funds)
8. Transaction send
9. Rate limit and stats recorded (only on success)
10. Lock release

## License

MIT
