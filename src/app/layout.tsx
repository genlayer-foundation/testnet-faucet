import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GenLayer Testnet Faucet | Get GEN Tokens",
  description:
    "Claim free GEN tokens for the GenLayer Testnet Asimov. 100 GEN per claim, once every 24 hours.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://testnet-faucet.genlayer.foundation"
  ),
  openGraph: {
    title: "GenLayer Testnet Faucet",
    description:
      "Claim free GEN tokens for testing on GenLayer Testnet Asimov.",
    type: "website",
  },
};

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
        {children}
      </body>
    </html>
  );
}
