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
            className="rounded-xl border border-black/[0.04] bg-white p-4"
          >
            <div className="skeleton-shimmer h-3 w-16 rounded" />
            <div className="skeleton-shimmer mt-2.5 h-6 w-12 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const items = [
    {
      label: "Total Claims",
      value: stats.totalClaims.toLocaleString(),
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-brand-purple/50">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ),
    },
    {
      label: "Unique Addresses",
      value: stats.uniqueAddresses.toLocaleString(),
      icon: (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-brand-purple/50">
          <circle cx="5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
          <circle cx="9.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M1 12.5c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="stat-card rounded-xl border border-black/[0.04] bg-white p-4"
        >
          <div className="flex items-center gap-1.5">
            {item.icon}
            <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
              {item.label}
            </p>
          </div>
          <p className="mt-2 text-[20px] font-semibold tracking-tight text-text-primary">
            {item.value}
          </p>
        </div>
      ))}
    </div>
  );
}
