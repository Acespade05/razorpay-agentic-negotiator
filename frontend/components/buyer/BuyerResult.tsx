"use client";

import {
  NegotiationResponse,
} from "../../lib/negotiation";

interface BuyerResultProps {
  response:
    | NegotiationResponse
    | null;
}

export default function BuyerResult({
  response,
}: BuyerResultProps) {
  if (!response) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Negotiation result
        </p>

        <h2 className="mt-2 text-lg font-semibold">
          Waiting for your first offer
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Choose Manual or AI Agent above
          to start the negotiation.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Negotiation result
          </p>

          <h2 className="mt-2 text-xl font-semibold capitalize">
            {response.status.replace(
              "_",
              " ",
            )}
          </h2>
        </div>

        <div className="text-right">
          <p className="text-xs text-slate-500">
            Current price
          </p>

          <p className="mt-1 text-xl font-bold">
            ₹
            {
              response.calculated_price
            }

            <span className="ml-1 text-sm font-normal text-slate-500">
              /unit
            </span>
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-slate-950 p-4">
          <p className="text-xs text-slate-500">
            Round
          </p>

          <p className="mt-1 font-semibold">
            {
              response.round_number
            }{" "}
            /{" "}
            {
              response.max_rounds
            }
          </p>
        </div>

        <div className="rounded-xl bg-slate-950 p-4">
          <p className="text-xs text-slate-500">
            Offer
          </p>

          <p className="mt-1 font-semibold">
            ₹
            {
              response.offered_price_per_unit
            }
          </p>
        </div>

        <div className="rounded-xl bg-slate-950 p-4">
          <p className="text-xs text-slate-500">
            Floor
          </p>

          <p className="mt-1 font-semibold">
            ₹
            {
              response.floor_price_per_unit
            }
          </p>
        </div>

        <div className="rounded-xl bg-slate-950 p-4">
          <p className="text-xs text-slate-500">
            Quantity
          </p>

          <p className="mt-1 font-semibold">
            {response.quantity}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Engine explanation
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          {response.reason}
        </p>

        {response.explanation && (
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {response.explanation}
          </p>
        )}
      </div>
    </section>
  );
}