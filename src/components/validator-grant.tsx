"use client";

import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { TransactionResult } from "./transaction-result";
import type { ClaimResponse } from "@/types";

interface ValidatorGrantProps {
  amount: string;
  minEth: string;
}

export function ValidatorGrant({ amount, minEth }: ValidatorGrantProps) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClaimResponse | null>(null);
  const [pending, setPending] = useState<ClaimResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
  const amountLabel = Number(amount).toLocaleString("en-US");

  const resetCaptcha = () => {
    turnstileRef.current?.reset();
    setTurnstileToken(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim() || !turnstileToken || loading) return;

    setLoading(true);
    setError(null);
    setPending(null);

    try {
      const res = await fetch("/api/validator-grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim(), turnstileToken }),
      });

      const data: ClaimResponse = await res.json();

      if (data.success) {
        setResult(data);
      } else if (data.pending) {
        setPending(data);
        resetCaptcha();
      } else {
        setError(data.error || "Something went wrong.");
        resetCaptcha();
      }
    } catch {
      setError(
        "Network error. If a grant was already submitted it cannot be paid twice. Please try again in a few minutes."
      );
      resetCaptcha();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-black/[0.04] bg-white p-4">
      <p className="text-[13px] font-medium text-text-primary">
        Running a validator?
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
        A wallet with at least {minEth} ETH on Ethereum mainnet can claim{" "}
        {amountLabel} GEN once.
      </p>

      {!session && (
        <p className="mt-3 text-[12px] text-text-secondary">
          Sign in with GitHub above to claim it.
        </p>
      )}

      {session && !open && (
        <button
          onClick={() => setOpen(true)}
          className="mt-3 flex h-[36px] w-full cursor-pointer items-center justify-center rounded-xl bg-surface-secondary/80 px-4 text-[13px] font-medium text-text-secondary ring-1 ring-black/[0.04] transition-all hover:bg-surface-secondary hover:text-text-primary"
        >
          Claim validator grant
        </button>
      )}

      {session && open && (
        <div className="mt-4 space-y-4">
          {!result && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="validator-address"
                  className="mb-2 block text-[13px] font-medium text-text-primary"
                >
                  Wallet holding the ETH
                </label>
                <input
                  id="validator-address"
                  type="text"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="0x..."
                  disabled={loading}
                  className="input-field h-[44px] w-full rounded-xl border border-black/[0.08] bg-surface-secondary/60 px-4 font-mono text-[14px] text-text-primary placeholder:text-text-placeholder focus:border-brand-purple focus:outline-none disabled:opacity-50"
                />
                <p className="mt-2 text-[12px] text-text-secondary">
                  The GEN is sent to this same address. One grant per wallet
                  and per GitHub account.
                </p>
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

              <button
                type="submit"
                disabled={!address.trim() || !turnstileToken || loading}
                className="flex h-[40px] w-full cursor-pointer items-center justify-center rounded-xl border border-brand-purple/30 bg-brand-purple-light px-4 text-[13px] font-semibold text-brand-purple transition-all hover:border-brand-purple/50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading
                  ? "Checking and sending..."
                  : pending
                    ? "Check again"
                    : `Claim ${amountLabel} GEN`}
              </button>
            </form>
          )}

          {error && (
            <div className="rounded-xl border border-error/15 bg-error-light px-4 py-3">
              <p className="text-[13px] font-medium text-error">{error}</p>
            </div>
          )}

          {pending && !result && (
            <div className="rounded-xl border border-warning/20 bg-warning-light px-4 py-3">
              <p className="text-[13px] font-medium text-text-primary">
                {pending.error}
              </p>
              {pending.explorerUrl && (
                <a
                  href={pending.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-[12px] font-medium text-brand-purple hover:underline"
                >
                  View the transaction
                </a>
              )}
            </div>
          )}

          {result?.success && result.txHash && result.explorerUrl && (
            <TransactionResult
              txHash={result.txHash}
              explorerUrl={result.explorerUrl}
              amount={Number(result.amount ?? amount)}
            />
          )}
        </div>
      )}
    </div>
  );
}
