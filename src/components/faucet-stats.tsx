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
        if (res.ok) setStats(await res.json());
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
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border-light bg-surface p-4"
          >
            <div className="h-3 w-16 rounded bg-surface-secondary" />
            <div className="mt-2 h-5 w-10 rounded bg-surface-secondary" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const items = [
    { label: "Total Claims", value: stats.totalClaims.toLocaleString() },
    { label: "Unique Addresses", value: stats.uniqueAddresses.toLocaleString() },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-border-light bg-surface p-4"
        >
          <p className="text-[12px] tracking-[0.24px] text-text-muted">
            {item.label}
          </p>
          <p className="mt-1 text-[17px] font-semibold tracking-[-0.32px] text-text-primary">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
