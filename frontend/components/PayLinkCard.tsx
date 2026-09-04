"use client";

import { useEffect, useState } from "react";

export interface PaymentLink {
  id: string;
  short_url: string;
  status?: string | null;
  created_at?: number | null;
  expire_by?: number | null;
  reference_id?: string | null;
}

interface PayLinkCardProps {
  paymentLink: PaymentLink;
  agreedPrice: string;
  quantity: number;
}

function formatRemaining(
  seconds: number,
): string {
  if (seconds <= 0) {
    return "Expired";
  }

  const minutes =
    Math.floor(seconds / 60);

  const remainingSeconds =
    seconds % 60;

  return `${minutes}m ${remainingSeconds
    .toString()
    .padStart(2, "0")}s`;
}

export default function PayLinkCard({
  paymentLink,
  agreedPrice,
  quantity,
}: PayLinkCardProps) {
  const [
    remainingSeconds,
    setRemainingSeconds,
  ] = useState(() => {
    if (!paymentLink.expire_by) {
      return 0;
    }

    return Math.max(
      0,
      paymentLink.expire_by -
        Math.floor(
          Date.now() / 1000,
        ),
    );
  });

  useEffect(() => {
    if (!paymentLink.expire_by) {
      return;
    }

    const interval =
      window.setInterval(() => {
        const remaining =
          Math.max(
            0,
            paymentLink.expire_by! -
              Math.floor(
                Date.now() / 1000,
              ),
          );

        setRemainingSeconds(
          remaining,
        );

        if (remaining === 0) {
          window.clearInterval(
            interval,
          );
        }
      }, 1000);

    return () => {
      window.clearInterval(
        interval,
      );
    };
  }, [paymentLink.expire_by]);

  const total =
    Number(agreedPrice) * quantity;

  const expired =
    remainingSeconds <= 0;

  return (
    <section className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-6 shadow-2xl shadow-emerald-950/20">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
            Agreement reached
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Payment ready
          </h2>

          <p className="mt-1 text-sm leading-6 text-slate-400">
            The negotiation was accepted by
            the deterministic backend engine.
          </p>
        </div>

        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
          Razorpay Test Mode
        </span>
      </div>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/80 p-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Agreed unit price
            </p>

            <p className="mt-1 text-2xl font-bold text-white">
              ₹{agreedPrice}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Quantity
            </p>

            <p className="mt-1 text-2xl font-bold text-white">
              {quantity}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-800 pt-5">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-400">
              Total negotiation value
            </span>

            <span className="text-2xl font-bold text-emerald-300">
              ₹{total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
            ₹
          </div>

          <div>
            <p className="text-sm font-semibold text-amber-200">
              Test payment environment
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              This is a Razorpay Test Mode payment
              link. No real money should be used for
              this demonstration.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Payment-link status
            </p>

            <p
              className={`mt-1 text-sm font-semibold ${
                expired
                  ? "text-red-300"
                  : "text-emerald-300"
              }`}
            >
              {expired
                ? "Payment link expired"
                : `Expires in ${formatRemaining(
                    remainingSeconds,
                  )}`}
            </p>
          </div>

          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-500">
            Test only
          </span>
        </div>
      </div>

      <a
        href={
          expired
            ? undefined
            : paymentLink.short_url
        }
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={expired}
        className={`mt-5 block w-full rounded-xl px-4 py-3 text-center font-bold transition ${
          expired
            ? "pointer-events-none bg-slate-800 text-slate-500"
            : "bg-emerald-400 text-slate-950 hover:bg-emerald-300"
        }`}
      >
        {expired
          ? "Payment link expired"
          : "Open Razorpay Test Payment ↗"}
      </a>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
          Demo verification note
        </p>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          Opening the payment link does not mean
          payment has been verified by this
          application. Payment confirmation requires
          a verified payment callback/webhook.
        </p>
      </div>

      <div className="mt-4 space-y-1 text-xs text-slate-500">
        {paymentLink.id && (
          <p>
            Link ID:{" "}
            <span className="font-mono text-slate-400">
              {paymentLink.id}
            </span>
          </p>
        )}

        {paymentLink.reference_id && (
          <p>
            Reference:{" "}
            <span className="font-mono text-slate-400">
              {paymentLink.reference_id}
            </span>
          </p>
        )}

        {paymentLink.status && (
          <p>
            Razorpay status:{" "}
            <span className="font-mono text-slate-400">
              {paymentLink.status}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}