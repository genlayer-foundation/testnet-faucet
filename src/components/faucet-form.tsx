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
        if (data.retryAfter) {
          setRetryAfter(data.retryAfter);
        }
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
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="address"
            className="mb-2 block text-sm font-medium tracking-[0.28px] text-text-primary"
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
            className="h-10 w-full rounded-lg border border-border-light bg-surface-secondary px-3 font-mono text-sm text-text-primary placeholder:text-text-placeholder transition-colors focus:border-brand-purple focus:ring-1 focus:ring-brand-purple focus:outline-none disabled:opacity-50"
          />
        </div>

        {siteKey && (
          <Turnstile
            ref={turnstileRef}
            siteKey={siteKey}
            onSuccess={setTurnstileToken}
            onError={() => setTurnstileToken(null)}
            onExpire={() => setTurnstileToken(null)}
            options={{
              theme: "light",
              size: "normal",
            }}
          />
        )}

        {!result && (
          <button
            type="submit"
            disabled={!address.trim() || !turnstileToken || loading}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-brand-purple px-4 text-sm font-medium tracking-[0.28px] text-white transition-colors hover:bg-brand-purple-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
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
                Sending...
              </>
            ) : (
              `Claim ${claimAmount} GEN`
            )}
          </button>
        )}
      </form>

      {error && (
        <div className="rounded-xl border border-error/20 bg-error-light p-4">
          <p className="text-sm tracking-[0.28px] text-error">{error}</p>
          {retryAfter && retryAfter > 0 && (
            <p className="mt-1 text-xs tracking-[0.24px] text-text-secondary">
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
          className="flex h-10 w-full items-center justify-center rounded-full bg-surface-secondary px-4 text-sm font-medium tracking-[0.28px] text-text-primary transition-colors hover:bg-border-default"
        >
          Claim for another address
        </button>
      )}
    </div>
  );
}
