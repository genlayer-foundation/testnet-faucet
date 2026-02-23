import { Header } from "@/components/header";
import { FaucetForm } from "@/components/faucet-form";
import { FaucetStatsDisplay } from "@/components/faucet-stats";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg space-y-8">
          <div className="text-center">
            <h1 className="text-[32px] font-medium leading-10 tracking-[-0.64px] text-text-primary">
              Testnet Faucet
            </h1>
            <p className="mt-2 text-sm tracking-[0.28px] text-text-secondary">
              Get {Number(process.env.NEXT_PUBLIC_CLAIM_AMOUNT) || 100} GEN
              tokens for testing on Testnet Asimov
            </p>
          </div>

          <div className="rounded-xl border border-border-light bg-surface p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)]">
            <FaucetForm />
          </div>

          <FaucetStatsDisplay />
        </div>
      </main>
      <Footer />
    </div>
  );
}
