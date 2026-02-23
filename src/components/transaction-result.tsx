"use client";

import { useState } from "react";

interface TransactionResultProps {
  txHash: string;
  explorerUrl: string;
  amount: number;
}

export function TransactionResult({
  txHash,
  explorerUrl,
  amount,
}: TransactionResultProps) {
  const [copied, setCopied] = useState(false);

  const truncatedHash = `${txHash.slice(0, 10)}...${txHash.slice(-8)}`;

  const copyHash = async () => {
    await navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-success/20 bg-success-light p-5">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M10 3L4.5 8.5L2 6"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium tracking-[0.28px] text-success">
            {amount} GEN sent successfully!
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="font-mono text-xs text-text-secondary">
              {truncatedHash}
            </code>
            <button
              onClick={copyHash}
              className="text-xs text-text-secondary transition-colors hover:text-text-primary"
              title="Copy transaction hash"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium tracking-[0.24px] text-brand-purple transition-colors hover:text-brand-purple-hover"
          >
            View on Explorer
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3.5 8.5L8.5 3.5M8.5 3.5H4.5M8.5 3.5V7.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
