import { defineChain } from "viem";
import { z } from "zod";

const httpUrl = z.url({ protocol: /^https?$/ });
const networkSchema = z.object({
  NEXT_PUBLIC_CHAIN_ID: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  NEXT_PUBLIC_CHAIN_NAME: z.string().trim().min(1),
  NEXT_PUBLIC_RPC_URL: httpUrl,
  NEXT_PUBLIC_EXPLORER_URL: httpUrl.transform((url) => url.replace(/\/+$/, "")),
});

export function getGenlayerChain() {
  // Public configuration only: this object is also used for wallet setup.
  const config = networkSchema.parse({
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
    NEXT_PUBLIC_CHAIN_NAME: process.env.NEXT_PUBLIC_CHAIN_NAME,
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
    NEXT_PUBLIC_EXPLORER_URL: process.env.NEXT_PUBLIC_EXPLORER_URL,
  });

  return defineChain({
    id: config.NEXT_PUBLIC_CHAIN_ID,
    name: config.NEXT_PUBLIC_CHAIN_NAME,
    nativeCurrency: {
      name: "GEN Token",
      symbol: "GEN",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [config.NEXT_PUBLIC_RPC_URL],
      },
    },
    blockExplorers: {
      default: {
        name: "GenLayer Explorer",
        url: config.NEXT_PUBLIC_EXPLORER_URL,
      },
    },
    testnet: true,
  });
}
