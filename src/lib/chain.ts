import { defineChain } from "viem";

export function getGenlayerChain() {
  return defineChain({
    id: Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 4221,
    name: "GenLayer Testnet Chain",
    nativeCurrency: {
      name: "GEN Token",
      symbol: "GEN",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [
          process.env.RPC_URL ||
            "https://zksync-os-testnet-genlayer.zksync.dev",
        ],
      },
    },
    blockExplorers: {
      default: {
        name: "GenLayer Explorer",
        url:
          process.env.NEXT_PUBLIC_EXPLORER_URL ||
          "https://zksync-os-testnet-genlayer.explorer.zksync.dev",
      },
    },
    testnet: true,
  });
}
