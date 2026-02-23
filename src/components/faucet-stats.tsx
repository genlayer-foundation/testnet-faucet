"use client";

import { useEffect, useState } from "react";
import type { FaucetStats } from "@/types";

export function FaucetStatsDisplay() {
  const [stats, setStats] = useState<FaucetStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/stats");
        if (res.ok) {
          setStats(await res.json());
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border-light bg-surface-secondary p-4"
          >
            <div className="h-3 w-16 rounded bg-border-default" />
            <div className="mt-2 h-6 w-12 rounded bg-border-default" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const items = [
    { label: "Total Claims", value: stats.totalClaims.toLocaleString() },
    {
      label: "Unique Addresses",
      value: stats.uniqueAddresses.toLocaleString(),
    },
    { label: "Claims Today", value: stats.claimsToday.toLocaleString() },
    {
      label: "Faucet Balance",
      value: `${Number(stats.faucetBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })} GEN`,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-border-light bg-surface-secondary p-4"
        >
          <p className="text-xs tracking-[0.24px] text-text-secondary">
            {item.label}
          </p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.32px] text-text-primary">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
