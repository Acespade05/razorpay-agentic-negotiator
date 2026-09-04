"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

interface Analytics {
  accepted_count: number;
  no_deal_count: number;
  total_negotiations: number;
  win_rate_percent: string;
  average_discount_percent: string;
  average_rounds_to_close: string;
  total_negotiated_revenue: string;
}

interface MerchantConfig {
  p_list: string;
  floor_1_9: string;
  floor_10_49: string;
  floor_50_99: string;
  floor_100_plus: string;
  alpha: string;
  max_rounds: number;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const defaultConfig: MerchantConfig = {
  p_list: "100.00",
  floor_1_9: "90.00",
  floor_10_49: "88.00",
  floor_50_99: "85.00",
  floor_100_plus: "80.00",
  alpha: "1.5",
  max_rounds: 5,
};

function formatCurrency(value: string | number): string {
  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(value);

  if (!Number.isFinite(numericValue)) {
    return "₹0.00";
  }

  return `₹${numericValue.toFixed(2)}`;
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#15191d] px-4 py-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-[25px] font-semibold leading-none tracking-tight text-slate-100">
        {value}
      </p>

      <p className="mt-1.5 text-[11px] text-slate-500">{detail}</p>
    </div>
  );
}

function StatusRow({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: "green" | "amber";
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#111519] px-3 py-2.5">
      <span className="text-xs text-slate-400">{label}</span>

      <span
        className={
          tone === "green"
            ? "text-[11px] font-semibold text-emerald-400"
            : "text-[11px] font-semibold text-amber-400"
        }
      >
        ● {status}
      </span>
    </div>
  );
}

function Insight({
  title,
  text,
  tone,
}: {
  title: string;
  text: string;
  tone: "positive" | "attention" | "neutral";
}) {
  const styles = {
    positive: {
      card: "border-emerald-400/10 bg-emerald-400/[0.06]",
      icon: "bg-emerald-400/10 text-emerald-400",
    },
    attention: {
      card: "border-amber-400/10 bg-amber-400/[0.06]",
      icon: "bg-amber-400/10 text-amber-400",
    },
    neutral: {
      card: "border-white/[0.07] bg-white/[0.025]",
      icon: "bg-white/[0.06] text-slate-400",
    },
  };

  return (
    <div
      className={`flex gap-3 rounded-xl border px-3 py-2.5 ${styles[tone].card}`}
    >
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${styles[tone].icon}`}
      >
        {tone === "attention" ? "!" : "✓"}
      </div>

      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-200">{title}</p>

        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
          {text}
        </p>
      </div>
    </div>
  );
}

function PricingInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-white/[0.08] bg-[#111519] px-2.5 py-2 text-sm font-semibold text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-400/30 focus:bg-[#13181c] focus:ring-2 focus:ring-emerald-400/10"
        inputMode={type === "number" ? "numeric" : "decimal"}
      />
    </label>
  );
}

export default function MerchantPage() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const [config, setConfig] =
    useState<MerchantConfig>(defaultConfig);

  const [draftConfig, setDraftConfig] =
    useState<MerchantConfig>(defaultConfig);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [analyticsResponse, configResponse] = await Promise.all([
        fetch(`${API_BASE}/api/merchant/analytics`),
        fetch(`${API_BASE}/api/merchant/config`),
      ]);

      if (!analyticsResponse.ok) {
        throw new Error("Could not load merchant analytics.");
      }

      if (!configResponse.ok) {
        throw new Error("Could not load merchant configuration.");
      }

      const analyticsData =
        (await analyticsResponse.json()) as Analytics;

      const configData =
        (await configResponse.json()) as MerchantConfig;

      setAnalytics(analyticsData);
      setConfig(configData);
      setDraftConfig(configData);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load merchant dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  async function saveConfiguration(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage("");
      setError("");

      const numericFields = [
        draftConfig.p_list,
        draftConfig.floor_1_9,
        draftConfig.floor_10_49,
        draftConfig.floor_50_99,
        draftConfig.floor_100_plus,
        draftConfig.alpha,
      ];

      if (
        numericFields.some(
          (value) =>
            value.trim() === "" ||
            !Number.isFinite(Number(value)),
        )
      ) {
        throw new Error(
          "Please enter valid numeric pricing values.",
        );
      }

      if (Number(draftConfig.p_list) <= 0) {
        throw new Error(
          "List price must be greater than zero.",
        );
      }

      const floors = [
        Number(draftConfig.floor_1_9),
        Number(draftConfig.floor_10_49),
        Number(draftConfig.floor_50_99),
        Number(draftConfig.floor_100_plus),
      ];

      if (
        floors.some(
          (floor) => floor > Number(draftConfig.p_list),
        )
      ) {
        throw new Error(
          "Every floor must be less than or equal to list price.",
        );
      }

      if (
        floors[0] < floors[1] ||
        floors[1] < floors[2] ||
        floors[2] < floors[3]
      ) {
        throw new Error(
          "Pricing floors must stay the same or decrease as quantity increases.",
        );
      }

      if (Number(draftConfig.alpha) <= 0) {
        throw new Error("Alpha must be greater than zero.");
      }

      if (
        !Number.isInteger(Number(draftConfig.max_rounds)) ||
        Number(draftConfig.max_rounds) < 2
      ) {
        throw new Error(
          "Maximum rounds must be at least 2.",
        );
      }

      const response = await fetch(
        `${API_BASE}/api/merchant/config`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            p_list: draftConfig.p_list,
            floor_1_9: draftConfig.floor_1_9,
            floor_10_49: draftConfig.floor_10_49,
            floor_50_99: draftConfig.floor_50_99,
            floor_100_plus: draftConfig.floor_100_plus,
            alpha: draftConfig.alpha,
            max_rounds: Number(draftConfig.max_rounds),
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.detail ||
            data?.error?.message ||
            "Could not save merchant configuration.",
        );
      }

      const savedConfig = data as MerchantConfig;

      setConfig(savedConfig);
      setDraftConfig(savedConfig);
      setMessage("Configuration is live.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save configuration.",
      );
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(
    field: keyof MerchantConfig,
    value: string,
  ) {
    setDraftConfig((current) => ({
      ...current,
      [field]:
        field === "max_rounds"
          ? Number(value)
          : value,
    }));
  }

  const outcomePercentage = useMemo(() => {
    if (
      !analytics ||
      analytics.total_negotiations === 0
    ) {
      return {
        accepted: 0,
        noDeal: 0,
      };
    }

    return {
      accepted:
        (analytics.accepted_count /
          analytics.total_negotiations) *
        100,

      noDeal:
        (analytics.no_deal_count /
          analytics.total_negotiations) *
        100,
    };
  }, [analytics]);

  const insights = useMemo(() => {
    if (!analytics) {
      return [];
    }

    const winRate = Number.parseFloat(
      analytics.win_rate_percent,
    );

    const discount = Number.parseFloat(
      analytics.average_discount_percent,
    );

    const rounds = Number.parseFloat(
      analytics.average_rounds_to_close,
    );

    const recommendations: {
      title: string;
      text: string;
      tone: "positive" | "attention" | "neutral";
    }[] = [];

    if (winRate >= 80) {
      recommendations.push({
        title: "Strong conversion",
        text: `${analytics.win_rate_percent}% of negotiations are closing. You may have room to test a firmer opening position.`,
        tone: "positive",
      });
    } else if (winRate < 60) {
      recommendations.push({
        title: "Conversion needs attention",
        text: `Win rate is ${analytics.win_rate_percent}%. Review whether your opening position or volume floors create too much friction.`,
        tone: "attention",
      });
    } else {
      recommendations.push({
        title: "Healthy conversion",
        text: `${analytics.win_rate_percent}% of negotiations are closing. Keep monitoring conversion against discount.`,
        tone: "positive",
      });
    }

    if (discount > 7) {
      recommendations.push({
        title: "Discount is elevated",
        text: `Average discount is ${analytics.average_discount_percent}%. Review higher-volume floors before giving additional concessions.`,
        tone: "attention",
      });
    } else if (discount <= 5) {
      recommendations.push({
        title: "Discount discipline",
        text: `Average discount is ${analytics.average_discount_percent}%, showing strong protection of merchant value.`,
        tone: "positive",
      });
    } else {
      recommendations.push({
        title: "Balanced pricing",
        text: `Average discount is ${analytics.average_discount_percent}%. Keep monitoring as negotiation volume grows.`,
        tone: "neutral",
      });
    }

    if (rounds > 3.5) {
      recommendations.push({
        title: "Negotiations take longer",
        text: `Deals average ${analytics.average_rounds_to_close} rounds. A tighter opening position could reduce negotiation length.`,
        tone: "attention",
      });
    } else {
      recommendations.push({
        title: "Efficient negotiation",
        text: `Deals close in ${analytics.average_rounds_to_close} rounds on average.`,
        tone: "positive",
      });
    }

    return recommendations;
  }, [analytics]);

  return (
    <main className="min-h-screen bg-[#0b0f12] text-slate-100">
      <div className="mx-auto max-w-[1500px] px-4 py-3 sm:px-5 lg:px-6">
        {/* Header */}
        <header className="mb-3 flex min-h-[68px] items-center justify-between rounded-2xl border border-white/[0.08] bg-[#111519] px-5 shadow-[0_10px_35px_rgba(0,0,0,0.22)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a2025] text-sm font-bold text-white ring-1 ring-white/[0.08]">
              R
            </div>

            <div>
              <p className="text-[15px] font-semibold tracking-tight text-slate-100">
                Razorpay Merchant Console
              </p>

              <p className="text-[11px] text-slate-500">
                Agentic Negotiation{" "}
                <span className="text-slate-700">•</span>{" "}
                Test Mode
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/"
              className="rounded-lg border border-white/[0.08] bg-[#151a1e] px-3 py-2 text-xs font-medium text-slate-400 transition hover:border-white/[0.14] hover:bg-[#1a2025] hover:text-slate-200"
            >
              ← Buyer Experience
            </a>

            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-[#07110c] transition hover:bg-emerald-400"
            >
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-3 rounded-xl border border-red-400/20 bg-red-400/[0.07] px-4 py-2.5 text-xs text-red-300">
            {error}
          </div>
        )}

        {/* KPI row */}
        <section className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            label="Negotiated revenue"
            value={
              loading || !analytics
                ? "—"
                : formatCurrency(
                    analytics.total_negotiated_revenue,
                  )
            }
            detail="Accepted negotiation value"
          />

          <MetricCard
            label="Win rate"
            value={
              loading || !analytics
                ? "—"
                : `${analytics.win_rate_percent}%`
            }
            detail="Accepted negotiations"
          />

          <MetricCard
            label="Average discount"
            value={
              loading || !analytics
                ? "—"
                : `${analytics.average_discount_percent}%`
            }
            detail="Against list price"
          />

          <MetricCard
            label="Average rounds"
            value={
              loading || !analytics
                ? "—"
                : analytics.average_rounds_to_close
            }
            detail="Rounds to close"
          />
        </section>

        {/* Analytics + insights */}
        <section className="grid gap-3 xl:grid-cols-[1.5fr_0.9fr]">
          {/* Performance */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111519] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  Negotiation performance
                </p>

                <p className="mt-0.5 text-[11px] text-slate-500">
                  Current accepted vs no-deal outcomes.
                </p>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-[#0d1215] px-3 py-1.5 text-right">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                  Total
                </p>

                <p className="text-sm font-semibold text-slate-200">
                  {analytics?.total_negotiations ?? "—"}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    Accepted
                  </span>

                  <span className="text-xs font-semibold text-slate-200">
                    {analytics?.accepted_count ?? "—"}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{
                      width: `${outcomePercentage.accepted}%`,
                    }}
                  />
                </div>

                <p className="mt-1 text-[10px] text-slate-600">
                  {analytics
                    ? `${outcomePercentage.accepted.toFixed(
                        1,
                      )}% of negotiations`
                    : "Loading"}
                </p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400">
                    No-deal
                  </span>

                  <span className="text-xs font-semibold text-slate-200">
                    {analytics?.no_deal_count ?? "—"}
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-slate-500 transition-all"
                    style={{
                      width: `${outcomePercentage.noDeal}%`,
                    }}
                  />
                </div>

                <p className="mt-1 text-[10px] text-slate-600">
                  {analytics
                    ? `${outcomePercentage.noDeal.toFixed(
                        1,
                      )}% of negotiations`
                    : "Loading"}
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/[0.05] bg-[#0d1215] px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                  Accepted
                </p>

                <p className="mt-0.5 text-lg font-semibold text-slate-200">
                  {analytics?.accepted_count ?? "—"}
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.05] bg-[#0d1215] px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                  No-deal
                </p>

                <p className="mt-0.5 text-lg font-semibold text-slate-200">
                  {analytics?.no_deal_count ?? "—"}
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.05] bg-[#0d1215] px-3 py-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                  Revenue
                </p>

                <p className="mt-0.5 text-lg font-semibold text-slate-200">
                  {analytics
                    ? formatCurrency(
                        analytics.total_negotiated_revenue,
                      )
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Insights */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111519] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.18)]">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/10 text-sm text-emerald-400">
                ✦
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-200">
                  Negotiation Insights
                </p>

                <p className="text-[10px] text-slate-600">
                  Actionable merchant guidance
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {loading ? (
                <div className="rounded-xl border border-white/[0.06] bg-[#0d1215] p-3 text-xs text-slate-500">
                  Loading insights...
                </div>
              ) : (
                insights.map((insight) => (
                  <Insight
                    key={insight.title}
                    title={insight.title}
                    text={insight.text}
                    tone={insight.tone}
                  />
                ))
              )}
            </div>

            <div className="mt-2 rounded-xl border border-white/[0.06] bg-[#0d1215] px-3 py-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">
                Engine guardrail
              </p>

              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">
                Insights are advisory. The deterministic engine
                remains the authority for price, floors, acceptance,
                and no-deal.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing + system */}
        <section className="mt-3 grid gap-3 xl:grid-cols-[1.5fr_0.9fr]">
          {/* Pricing */}
          <form
            onSubmit={saveConfiguration}
            className="rounded-2xl border border-white/[0.08] bg-[#111519] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.18)]"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  Pricing controls
                </p>

                <p className="mt-0.5 text-[10px] text-slate-600">
                  Live merchant configuration
                </p>
              </div>

              {message && (
                <span className="rounded-lg bg-emerald-400/10 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-400">
                  ✓ {message}
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-7">
              <PricingInput
                label="List"
                value={draftConfig.p_list}
                onChange={(value) =>
                  updateDraft("p_list", value)
                }
              />

              <PricingInput
                label="Q1–9"
                value={draftConfig.floor_1_9}
                onChange={(value) =>
                  updateDraft("floor_1_9", value)
                }
              />

              <PricingInput
                label="Q10–49"
                value={draftConfig.floor_10_49}
                onChange={(value) =>
                  updateDraft("floor_10_49", value)
                }
              />

              <PricingInput
                label="Q50–99"
                value={draftConfig.floor_50_99}
                onChange={(value) =>
                  updateDraft("floor_50_99", value)
                }
              />

              <PricingInput
                label="Q100+"
                value={draftConfig.floor_100_plus}
                onChange={(value) =>
                  updateDraft("floor_100_plus", value)
                }
              />

              <PricingInput
                label="Alpha"
                value={draftConfig.alpha}
                onChange={(value) =>
                  updateDraft("alpha", value)
                }
              />

              <PricingInput
                label="Max rounds"
                type="number"
                value={draftConfig.max_rounds}
                onChange={(value) =>
                  updateDraft("max_rounds", value)
                }
              />
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-[10px] text-slate-600">
                Current list {formatCurrency(config.p_list)}{" "}
                <span className="text-slate-700">•</span>{" "}
                {config.max_rounds} max rounds
              </p>

              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-[11px] font-semibold text-[#07110c] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save pricing"}
              </button>
            </div>
          </form>

          {/* System */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111519] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-200">
                  System status
                </p>

                <p className="mt-0.5 text-[10px] text-slate-600">
                  Negotiation infrastructure
                </p>
              </div>

              <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-400">
                Operational
              </span>
            </div>

            <div className="mt-3 space-y-2">
              <StatusRow
                label="Deterministic engine"
                status="Active"
                tone="green"
              />

              <StatusRow
                label="AI explanation"
                status="Active"
                tone="green"
              />

              <StatusRow
                label="Razorpay payment"
                status="Test Mode"
                tone="amber"
              />
            </div>

            <p className="mt-2 text-[9px] leading-4 text-slate-600">
              Test payment links are generated by Razorpay. Payment
              verification requires a verified callback or webhook.
            </p>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-white/[0.06] px-1 py-2.5 text-[9px] text-slate-600">
          <span>
            Agentic Negotiation Console{" "}
            <span className="text-slate-700">•</span>{" "}
            Merchant-controlled pricing
          </span>

          <span>
            Engine{" "}
            <span className="text-slate-700">→</span>{" "}
            AI explanation{" "}
            <span className="text-slate-700">→</span>{" "}
            Razorpay payment link
          </span>
        </footer>
      </div>
    </main>
  );
}