"use client";

import { useState } from "react";

interface WalletNetwork {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}

export function AddNetworkButton({ network }: { network: WalletNetwork }) {
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
        params: [network],
      });
      setStatus("added");
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <div className="space-y-3">
      <button
        onClick={addNetwork}
        disabled={status === "adding"}
        className="group flex h-[40px] w-full items-center justify-center gap-2 rounded-xl border border-black/[0.08] bg-white px-4 text-[13px] font-medium text-text-primary transition-all hover:border-brand-purple/20 hover:bg-brand-purple-light hover:text-brand-purple disabled:opacity-50"
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
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="text-text-muted group-hover:text-brand-purple transition-colors">
            <path
              d="M8 3.5V12.5M3.5 8H12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
        {status === "added" && (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="text-success">
            <path
              d="M13 4.5L6.5 11L3 7.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {status === "idle" && `Add ${network.chainName} to Wallet`}
        {status === "adding" && "Adding..."}
        {status === "added" && "Network request accepted"}
        {status === "error" && "Failed - Try Again"}
      </button>
      <details className="text-[12px] text-text-secondary">
        <summary className="cursor-pointer">Already have a GenLayer network in your wallet?</summary>
        <p className="mt-2">
          If it uses chain ID {Number(network.chainId)}, edit its RPC and explorer
          to the values below. Your wallet may keep the old RPC even after accepting
          this request. Select the updated network to view your GEN balance.
        </p>
        <dl className="mt-2 space-y-1 break-all">
          <dt className="font-medium">RPC URL</dt>
          <dd className="select-all font-mono">{network.rpcUrls[0]}</dd>
          <dt className="font-medium">Explorer URL</dt>
          <dd className="select-all font-mono">{network.blockExplorerUrls[0]}</dd>
        </dl>
      </details>
    </div>
  );
}
