"use client";

import { useState } from "react";

export function AddNetworkButton() {
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">(
    "idle"
  );

  const addNetwork = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      window.open("https://metamask.io/download/", "_blank");
      return;
    }

    setStatus("adding");
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${(Number(process.env.NEXT_PUBLIC_CHAIN_ID) || 4221).toString(16)}`,
            chainName: "GenLayer Testnet Asimov",
            nativeCurrency: {
              name: "GEN",
              symbol: "GEN",
              decimals: 18,
            },
            rpcUrls: ["https://zksync-os-testnet-genlayer.zksync.dev"],
            blockExplorerUrls: [
              process.env.NEXT_PUBLIC_EXPLORER_URL ||
                "https://explorer-asimov.genlayer.com",
            ],
          },
        ],
      });
      setStatus("added");
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <button
      onClick={addNetwork}
      disabled={status === "adding"}
      className="flex h-[40px] w-full items-center justify-center gap-2 rounded-full bg-surface-dark px-4 text-[14px] font-medium tracking-[0.28px] text-white transition-colors hover:bg-[#2a2a2b] disabled:opacity-50"
    >
      {status === "adding" && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {status === "idle" && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 3.5V12.5M3.5 8H12.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}
      {status === "added" && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M13 4.5L6.5 11L3 7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {status === "idle" && "Add GenLayer Testnet to Wallet"}
      {status === "adding" && "Adding..."}
      {status === "added" && "Network Added!"}
      {status === "error" && "Failed - Try Again"}
    </button>
  );
}
