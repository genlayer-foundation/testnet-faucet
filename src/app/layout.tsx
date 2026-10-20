import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthSessionProvider } from "@/components/session-provider";
import { getGenlayerChain } from "@/lib/chain";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export function generateMetadata(): Metadata {
  const networkName = getGenlayerChain().name;
  const claimAmount = Number(process.env.NEXT_PUBLIC_CLAIM_AMOUNT) || 100;
  return {
    title: "GenLayer Testnet Faucet | Get GEN Tokens",
    description:
      `Claim free GEN tokens for ${networkName}. ${claimAmount} GEN per claim, once every 7 days.`,
    metadataBase: new URL(
      process.env.NEXT_PUBLIC_APP_URL || "https://testnet-faucet.genlayer.foundation"
    ),
    openGraph: {
      title: "GenLayer Testnet Faucet",
      description:
        `Claim free GEN tokens for testing on ${networkName}.`,
      type: "website",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
