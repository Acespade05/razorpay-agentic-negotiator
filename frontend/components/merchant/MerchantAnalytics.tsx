"use client";

import { useCallback, useEffect, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

interface MerchantAnalyticsData {
  accepted_count: number;
  no_deal_count: number;
  total_negotiations: number;
  win_rate_percent: string;
  average_discount_percent: string;
  average_rounds_to_close: string;
  total_negotiated_revenue: string;
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        {label}
      </p>

      <p className="mt-3 text-2xl font-bold text-slate-100">
        {value}
      </p>

      {description && (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}

export default function MerchantAnalytics() {
  const [analytics, setAnalytics] =
    useState<MerchantAnalyticsData | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadAnalytics =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/merchant/analytics`,
          );

        if (!response.ok) {
          throw new Error(
            "Unable to load merchant analytics.",
          );
        }

        const data =
          (await response.json()) as MerchantAnalyticsData;

        setAnalytics(data);
      } catch (analyticsError) {
        console.error(
          analyticsError,
        );

        setError(
          "Could not load analytics. Make sure FastAPI is running on port 8000.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
            Merchant analytics
          </p>

          <h2 className="mt-2 text-2xl font-semibold">
            Negotiation performance
          </h2>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Aggregated results from completed
            negotiations. Security rejections are
            excluded from these business metrics.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadAnalytics()
          }
          disabled={loading}
          className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading
            ? "Refreshing…"
            : "Refresh"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200"
        >
          <p>{error}</p>

          <button
            type="button"
            onClick={() =>
              void loadAnalytics()
            }
            className="mt-3 font-semibold underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      )}

      {loading && !analytics ? (
        <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950 p-8 text-center">
          <p className="text-sm text-slate-400">
            Loading merchant metrics…
          </p>
        </div>
      ) : analytics ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Accepted"
              value={String(
                analytics.accepted_count,
              )}
              description="Negotiations that reached agreement."
            />

            <MetricCard
              label="No deal"
              value={String(
                analytics.no_deal_count,
              )}
              description="Negotiations that ended without agreement."
            />

            <MetricCard
              label="Win rate"
              value={`${analytics.win_rate_percent}%`}
              description="Accepted negotiations divided by completed outcomes."
            />

            <MetricCard
              label="Total negotiations"
              value={String(
                analytics.total_negotiations,
              )}
              description="Completed accepted and no-deal negotiations."
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <MetricCard
              label="Average discount"
              value={`${analytics.average_discount_percent}%`}
              description="Average reduction from list price on accepted deals."
            />

            <MetricCard
              label="Average rounds"
              value={
                analytics.average_rounds_to_close
              }
              description="Average number of rounds required to close accepted deals."
            />

            <MetricCard
              label="Negotiated revenue"
              value={`₹${analytics.total_negotiated_revenue}`}
              description="Accepted unit price multiplied by negotiated quantity."
            />
          </div>
        </>
      ) : (
        <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-8 text-center">
          <p className="font-semibold text-slate-300">
            No analytics available
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Complete a negotiation to begin
            building merchant performance data.
          </p>
        </div>
      )}
    </section>
  );
}