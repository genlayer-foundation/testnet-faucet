import { Header } from "@/components/header";
import { FaucetForm } from "@/components/faucet-form";
import { FaucetStatsDisplay } from "@/components/faucet-stats";
import { AddNetworkButton } from "@/components/add-network-button";
import { Footer } from "@/components/footer";

export default function Home() {
  const claimAmount = Number(process.env.NEXT_PUBLIC_CLAIM_AMOUNT) || 100;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-16 sm:py-24">
        {/* Background layers */}
        <div className="gradient-mesh pointer-events-none absolute inset-0" />
        <div className="noise-overlay pointer-events-none absolute inset-0" />

        <div className="relative z-10 w-full max-w-[440px] space-y-8">
          {/* Hero */}
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-purple/10 to-brand-purple/5 ring-1 ring-brand-purple/10">
              <svg
                width="26"
                height="26"
                viewBox="0 0 256 256"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M118.926 101.26L86.4419 169.548L117.021 184.828L32 218.275L118.926 37.7246V101.26Z"
                  fill="#9e4bf6"
                />
                <path
                  d="M137.074 101.26L169.559 169.548L138.979 184.828L224.001 218.275L137.074 37.7246V101.26Z"
                  fill="#9e4bf6"
                />
                <path
                  d="M127.529 123.709L146.56 161.339L127.529 170.668L109.52 161.3L127.529 123.709Z"
                  fill="#9e4bf6"
                />
              </svg>
            </div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.02em] text-text-primary sm:text-[32px]">
              Testnet Faucet
            </h1>
            <p className="mx-auto mt-2.5 max-w-[280px] text-[15px] leading-relaxed text-text-secondary">
              Get {claimAmount} GEN tokens for testing on Testnet Asimov
            </p>
          </div>

          {/* Form card */}
          <div className="card-elevated rounded-2xl p-6">
            <FaucetForm />
          </div>

          {/* Info pills */}
          <div className="flex items-center justify-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[12px] font-medium tracking-wide text-text-secondary ring-1 ring-black/[0.04]">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="text-text-muted">
                <circle
                  cx="7"
                  cy="7"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
                <path
                  d="M7 4V7.5L9 9"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
              Once per 24h
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[12px] font-medium tracking-wide text-text-secondary ring-1 ring-black/[0.04]">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="text-brand-purple/60">
                <path
                  d="M7 1.5L8.5 5H12L9 7.5L10 11L7 9L4 11L5 7.5L2 5H5.5L7 1.5Z"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
              {claimAmount} GEN per claim
            </span>
          </div>

          {/* Add network */}
          <AddNetworkButton />

          {/* Stats */}
          <FaucetStatsDisplay />
        </div>
      </main>

      <Footer />
    </div>
  );
}
