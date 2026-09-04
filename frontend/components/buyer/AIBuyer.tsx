"use client";

import { useState } from "react";

import {
  formatMoney,
  NegotiationResponse,
} from "../../lib/negotiation";

type AgentStrategy =
  | "aggressive"
  | "balanced"
  | "conservative";

interface AIBuyerProps {
  sessionId: string;
  disabled?: boolean;
  quantity: string;
  productName: string;
  listPrice: string;
  availableStock: number | null;
  loading: boolean;

  onQuantityChange: (
    value: string,
  ) => void;

  onSubmit: (
    quantity: number,
    offer: string,
  ) => Promise<NegotiationResponse | null>;

  onError: (
    message: string,
  ) => void;
}

const STRATEGIES: Array<{
  id: AgentStrategy;
  name: string;
  startPercent: number;
}> = [
  {
    id: "aggressive",
    name: "Aggressive",
    startPercent: 0.9,
  },
  {
    id: "balanced",
    name: "Balanced",
    startPercent: 0.93,
  },
  {
    id: "conservative",
    name: "Conservative",
    startPercent: 0.96,
  },
];

function toCents(
  value: string,
): number {
  const normalized =
    value.trim();

  if (
    !/^\d+(\.\d{1,2})?$/.test(
      normalized,
    )
  ) {
    return 0;
  }

  const [
    whole,
    decimal = "",
  ] = normalized.split(".");

  return (
    Number(whole) * 100 +
    Number(
      decimal.padEnd(2, "0"),
    )
  );
}

function fromCents(
  cents: number,
): string {
  const safe =
    Math.max(
      0,
      Math.round(cents),
    );

  return `${Math.floor(
    safe / 100,
  )}.${String(
    safe % 100,
  ).padStart(2, "0")}`;
}

export default function AIBuyer({
  sessionId,
  quantity,
  productName,
  listPrice,
  availableStock,
  loading,
  onQuantityChange,
  onSubmit,
  onError,
  disabled = false,
}: AIBuyerProps) {
  const [
    strategy,
    setStrategy,
  ] =
    useState<AgentStrategy>(
      "balanced",
    );

  const [
    budget,
    setBudget,
  ] = useState("96.00");

  const [
    agentRunning,
    setAgentRunning,
  ] = useState(false);

  const [
    deliberating,
    setDeliberating,
  ] = useState(false);

  async function startNegotiation() {
    if (disabled) {
      return;
    }

    const parsedQuantity =
      Number(quantity);

    const budgetCents =
      toCents(budget);

    const listCents =
      toCents(listPrice);

    if (
      !sessionId ||
      !Number.isInteger(
        parsedQuantity,
      ) ||
      parsedQuantity <= 0
    ) {
      onError(
        "Quantity must be a positive whole number.",
      );
      return;
    }

    if (
      availableStock !== null &&
      parsedQuantity >
        availableStock
    ) {
      onError(
        `Only ${availableStock} units are currently available.`,
      );
      return;
    }

    if (
      budgetCents <= 0
    ) {
      onError(
        "Maximum buyer budget must be greater than zero.",
      );
      return;
    }

    if (
      listCents <= 0
    ) {
      onError(
        "List price is unavailable.",
      );
      return;
    }

    if (
      budgetCents >
      listCents
    ) {
      onError(
        "Maximum buyer budget cannot exceed the list price.",
      );
      return;
    }

    setAgentRunning(true);
    onError("");

    const selectedStrategy =
      STRATEGIES.find(
        (item) =>
          item.id === strategy,
      ) ??
      STRATEGIES[1];

    let currentOfferCents =
      Math.min(
        budgetCents,
        Math.max(
          1,
          Math.round(
            listCents *
              selectedStrategy.startPercent,
          ),
        ),
      );

    try {
      for (
        let attempt = 0;
        attempt < 5;
        attempt += 1
      ) {
        const nextResponse =
          await onSubmit(
            parsedQuantity,
            formatMoney(
              fromCents(
                currentOfferCents,
              ),
            ),
          );

        if (!nextResponse) {
          break;
        }

        if (
          nextResponse.status ===
            "accepted" ||
          nextResponse.status ===
            "no_deal"
        ) {
          break;
        }

        setDeliberating(true);

        await new Promise<void>((resolve) => {
          window.setTimeout(
            resolve,
            400,
          );
        });

        setDeliberating(false);

        const remainingRounds =
          Math.max(
            1,
            nextResponse.max_rounds -
              nextResponse.round_number,
          );

        const currentCents =
          toCents(
            nextResponse.offered_price_per_unit,
          );

        const merchantCents =
          toCents(
            nextResponse.calculated_price,
          );

        const midpoint =
          Math.round(
            (currentCents +
              merchantCents) /
              2,
          );

        const budgetStep =
          currentCents +
          Math.ceil(
            (budgetCents -
              currentCents) /
              remainingRounds,
          );

        currentOfferCents =
          Math.min(
            budgetCents,
            Math.max(
              currentCents + 1,
              midpoint,
              budgetStep,
            ),
          );
      }
    } finally {
      setDeliberating(false);
      setAgentRunning(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-4">
        {/* Compact header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">
              Autonomous AI buyer
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              Let the agent negotiate
            </h2>
          </div>

          <div className="text-right">
            <p className="font-semibold text-slate-100">
              {productName}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              ₹{listPrice}/unit
              {" · "}
              {availableStock === null
                ? "Checking stock"
                : `${availableStock} available`}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="grid gap-3 lg:grid-cols-[0.6fr_1.55fr_0.8fr_auto]">
          <div>
            <label
              htmlFor="agent-quantity"
              className="mb-1.5 block text-xs font-medium text-slate-400"
            >
              Quantity
            </label>

            <input
              id="agent-quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              disabled={
                loading ||
                agentRunning ||
                disabled
              }
              onChange={(event) =>
                onQuantityChange(
                  event.target.value,
                )
              }
              className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm text-slate-100 outline-none transition focus:border-violet-400"
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-400">
              Strategy
            </p>

            <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-700 bg-slate-950 p-1.5">
              {STRATEGIES.map(
                (item) => {
                  const selected =
                    strategy ===
                    item.id;

                  return (
                    <button
                      key={
                        item.id
                      }
                      type="button"
                      disabled={
                        loading ||
                        agentRunning ||
                        disabled
                      }
                      onClick={() =>
                        setStrategy(
                          item.id,
                        )
                      }
                      className={`h-9 rounded-lg px-2 text-xs font-semibold transition ${
                        selected
                          ? "bg-violet-400 text-slate-950"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="agent-budget"
              className="mb-1.5 block text-xs font-medium text-slate-400"
            >
              Max budget / unit
            </label>

            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                ₹
              </span>

              <input
                id="agent-budget"
                type="text"
                inputMode="decimal"
                value={budget}
                disabled={
                  loading ||
                  agentRunning ||
                  disabled
                }
                onChange={(event) =>
                  setBudget(
                    event.target.value,
                  )
                }
                className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-9 pr-4 text-sm text-slate-100 outline-none transition focus:border-violet-400"
              />
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() =>
                void startNegotiation()
              }
              disabled={
                loading ||
                agentRunning ||
                disabled ||
                !sessionId
              }
              className="h-12 w-full rounded-xl bg-violet-400 px-5 font-bold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-50 lg:min-w-44"
            >
              {agentRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                  {deliberating
                    ? "AI deliberating…"
                    : "AI negotiating…"}
                </span>
              ) : (
                "Start AI negotiation"
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <span>
            {deliberating
              ? "AI is deliberating on the next offer…"
              : "Agent controls offers"}
          </span>

          <span>
            Backend controls merchant price,
            floor & decision
          </span>

          <span>
            Budget: ₹{budget}
          </span>
        </div>
      </div>
    </section>
  );
}