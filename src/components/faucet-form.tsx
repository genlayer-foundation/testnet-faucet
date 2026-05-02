"use client";

import { useState, useRef, useCallback } from "react";
import { useSession, signIn } from "next-auth/react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { TransactionResult } from "./transaction-result";
import type { ClaimResponse } from "@/types";

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function FaucetForm() {
  const { data: session, status } = useSession();
  const [address, setAddress] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClaimResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  const claimAmount = Number(process.env.NEXT_PUBLIC_CLAIM_AMOUNT) || 100;
  const minEthBalance = Number(process.env.NEXT_PUBLIC_MIN_ETH_BALANCE) || 0.01;
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
      const formData = new FormData(e.target as HTMLFormElement);
      const honeypot = formData.get("website") as string;

      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          turnstileToken,
          ...(honeypot && { website: honeypot }),
        }),
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

  if (status === "loading") {
    return (
      <div className="space-y-4">
        <div className="h-[44px] w-full rounded-xl skeleton-shimmer" />
        <div className="h-[44px] w-full rounded-xl skeleton-shimmer" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="space-y-4 text-center">
        <button
          onClick={() => signIn("github")}
          className="btn-glow flex h-[44px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-brand-purple to-[#8a3ae0] px-4 text-[14px] font-semibold text-white"
        >
          <GitHubIcon className="h-4.5 w-4.5" />
          Sign in with GitHub
        </button>
        <p className="text-[12px] text-text-secondary">
          A GitHub account older than 3 months with at least 1 public repo is required.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="address"
            className="mb-1.5 block text-[13px] font-medium text-text-primary"
          >
            Wallet Address
          </label>
          <p className="mb-2 text-[12px] text-text-secondary">
            Requires at least {minEthBalance} ETH on Ethereum mainnet
          </p>
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

        {/* Honeypot field — hidden from real users, bots auto-fill it */}
        <div style={{ display: "none" }} aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            type="text"
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
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
              options={{ theme: "light", size: "normal", action: "claim" }}
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
