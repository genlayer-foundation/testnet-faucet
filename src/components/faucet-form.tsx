"use client";

import { useState, useRef, useCallback } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { TransactionResult } from "./transaction-result";
import type { ClaimResponse } from "@/types";

export function FaucetForm() {
  const [address, setAddress] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClaimResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  const claimAmount = Number(process.env.NEXT_PUBLIC_CLAIM_AMOUNT) || 100;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

  const resetForm = useCallback(() => {
    setResult(null);
    setError(null);
    setRetryAfter(null);
    turnstileRef.current?.reset();
    setTurnstileToken(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !turnstileToken || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setRetryAfter(null);

    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), turnstileToken }),
      });

      const data: ClaimResponse = await res.json();

      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "Something went wrong.");
        if (data.retryAfter) setRetryAfter(data.retryAfter);
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    } finally {
      setLoading(false);
    }
  };

  const formatRetryTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="address"
            className="mb-2 block text-[13px] font-medium text-text-primary"
          >
            Wallet Address
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              if (error) resetForm();
            }}
            placeholder="0x..."
            disabled={loading || !!result}
            className="input-field h-[44px] w-full rounded-xl border border-black/[0.08] bg-surface-secondary/60 px-4 font-mono text-[14px] text-text-primary placeholder:text-text-placeholder focus:border-brand-purple focus:outline-none disabled:opacity-50"
          />
        </div>

        {siteKey && (
          <div className="flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={siteKey}
              onSuccess={setTurnstileToken}
              onError={() => setTurnstileToken(null)}
              onExpire={() => setTurnstileToken(null)}
              options={{ theme: "light", size: "normal" }}
            />
          </div>
        )}

        {!result && (
          <button
            type="submit"
            disabled={!address.trim() || !turnstileToken || loading}
            className="btn-glow flex h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand-purple to-[#8a3ae0] px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:[transform:none]"
          >
            {loading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
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
                Sending GEN...
              </>
            ) : (
              `Claim ${claimAmount} GEN`
            )}
          </button>
        )}
      </form>

      {error && (
        <div className="rounded-xl border border-error/15 bg-error-light px-4 py-3">
          <p className="text-[13px] font-medium text-error">{error}</p>
          {retryAfter && retryAfter > 0 && (
            <p className="mt-1 text-[12px] text-text-secondary">
              Try again in {formatRetryTime(retryAfter)}
            </p>
          )}
        </div>
      )}

      {result?.success && result.txHash && result.explorerUrl && (
        <TransactionResult
          txHash={result.txHash}
          explorerUrl={result.explorerUrl}
          amount={claimAmount}
        />
      )}

      {result?.success && (
        <button
          onClick={() => {
            setAddress("");
            resetForm();
          }}
          className="flex h-[40px] w-full items-center justify-center rounded-xl bg-surface-secondary/80 px-4 text-[13px] font-medium text-text-secondary ring-1 ring-black/[0.04] transition-all hover:bg-surface-secondary hover:text-text-primary"
        >
          Claim for another address
        </button>
      )}
    </div>
  );
}
