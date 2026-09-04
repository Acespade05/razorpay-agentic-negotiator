"use client";

import { FormEvent } from "react";

interface ManualBuyerProps {
  quantity: string;
  offer: string;
  productName: string;
  listPrice: string;
  availableStock: number | null;
  loading: boolean;
  sessionId: string;

  onQuantityChange: (
    value: string,
  ) => void;

  onOfferChange: (
    value: string,
  ) => void;

  onSubmit: (
    quantity: number,
    offer: string,
  ) => Promise<void> | void;

  onError: (
    message: string,
  ) => void;
}

export default function ManualBuyer({
  quantity,
  offer,
  productName,
  listPrice,
  availableStock,
  loading,
  sessionId,
  onQuantityChange,
  onOfferChange,
  onSubmit,
  onError,
}: ManualBuyerProps) {
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const parsedQuantity =
      Number(quantity);

    if (
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
      parsedQuantity > availableStock
    ) {
      onError(
        `Only ${availableStock} units are currently available.`,
      );
      return;
    }

    if (!offer.trim()) {
      onError(
        "Please enter an offer price.",
      );
      return;
    }

    onError("");

    await onSubmit(
      parsedQuantity,
      offer,
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-4">
        {/* Compact product context */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
              Manual buyer
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              Make your offer
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

        {/* Inputs */}
        <form
          onSubmit={handleSubmit}
          className="grid gap-3 sm:grid-cols-[0.65fr_1.2fr_auto]"
        >
          <div>
            <label
              htmlFor="manual-quantity"
              className="mb-1.5 block text-xs font-medium text-slate-400"
            >
              Quantity
            </label>

            <input
              id="manual-quantity"
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(event) =>
                onQuantityChange(
                  event.target.value,
                )
              }
              className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
            />
          </div>

          <div>
            <label
              htmlFor="manual-offer"
              className="mb-1.5 block text-xs font-medium text-slate-400"
            >
              Your offer / unit
            </label>

            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                ₹
              </span>

              <input
                id="manual-offer"
                type="text"
                inputMode="decimal"
                value={offer}
                onChange={(event) =>
                  onOfferChange(
                    event.target.value,
                  )
                }
                className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-9 pr-4 text-sm text-slate-100 outline-none transition focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={
                loading ||
                !sessionId
              }
              className="h-12 w-full rounded-xl bg-cyan-400 px-6 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-36"
            >
              {loading
                ? "Negotiating…"
                : "Send offer"}
            </button>
          </div>
        </form>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
          <span>
            Backend price authority
          </span>

          <span>·</span>

          <span>
            Max 5 rounds
          </span>

          <span>·</span>

          <span>
            Floor enforced
          </span>
        </div>
      </div>
    </section>
  );
}