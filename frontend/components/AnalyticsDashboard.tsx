"use client";

import { useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type Analytics = {
  accepted_count: number;
  no_deal_count: number;
  total_negotiations: number;
  win_rate_percent: string | null;
  average_discount_percent: string | null;
  average_rounds_to_close: string | null;
  total_negotiated_revenue: string;
};

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_BASE_URL}/api/merchant/analytics`,
        {
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load analytics.");
      }

      const data: Analytics = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load analytics.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Merchant Analytics
        </h2>

        <p className="mt-4 text-sm text-slate-500">
          Loading analytics...
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Merchant Analytics
        </h2>

        <p className="mt-4 text-sm text-red-600">
          {error}
        </p>

        <button
          type="button"
          onClick={loadAnalytics}
          className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!analytics || analytics.total_negotiations === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Merchant Analytics
        </h2>

        <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="font-medium text-slate-800">
            No completed negotiations yet
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Analytics will appear here once negotiations
            are accepted or end in no-deal.
          </p>
        </div>
      </section>
    );
  }

  const cards = [
    {
      label: "Win Rate",
      value:
        analytics.win_rate_percent !== null
          ? `${analytics.win_rate_percent}%`
          : "—",
      description: "Accepted deals",
    },
    {
      label: "Average Discount",
      value:
        analytics.average_discount_percent !== null
          ? `${analytics.average_discount_percent}%`
          : "—",
      description: "Discount from list price",
    },
    {
      label: "Avg. Rounds to Close",
      value:
        analytics.average_rounds_to_close !== null
          ? analytics.average_rounds_to_close
          : "—",
      description: "Accepted negotiations",
    },
    {
      label: "Negotiated Revenue",
      value: `₹${analytics.total_negotiated_revenue}`,
      description: "Accepted deals",
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Merchant Analytics
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Live metrics calculated from completed negotiations.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAnalytics}
          className="w-fit rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-slate-50 p-5"
          >
            <p className="text-sm font-medium text-slate-500">
              {card.label}
            </p>

            <p className="mt-3 text-2xl font-bold text-slate-900">
              {card.value}
            </p>

            <p className="mt-2 text-xs text-slate-500">
              {card.description}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">
            Accepted Deals
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {analytics.accepted_count}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">
            No-Deal Negotiations
          </p>

          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {analytics.no_deal_count}
          </p>
        </div>
      </div>
    </section>
  );
}