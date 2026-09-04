"use client";

export type AuditEventType =
  | "counter"
  | "accepted"
  | "rejected"
  | "security"
  | "velocity";

export interface AuditEvent {
  id: string;
  roundNumber: number;
  offeredPrice: string;
  calculatedPrice: string | null;
  status: "continue" | "accepted" | "rejected" | "no_deal";
  reason: string;
  explanation: string;
  source: "human" | "agent";
  type: AuditEventType;
}

interface AuditLogViewProps {
  events: AuditEvent[];
}

function statusLabel(event: AuditEvent): string {
  if (event.type === "security") {
    return "Security rejection";
  }

  if (event.type === "velocity") {
    return "Velocity limit";
  }

  if (event.status === "accepted") {
    return "Accepted";
  }

  if (event.status === "no_deal") {
    return "No deal";
  }

  return "Counter-offer";
}

export default function AuditLogView({
  events,
}: AuditLogViewProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
            Decision trace
          </p>

          <h2 className="mt-2 text-xl font-semibold">
            Negotiation audit log
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Every negotiation decision is visible and
            attributable to its source.
          </p>
        </div>

        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs text-slate-400">
          {events.length} event{events.length === 1 ? "" : "s"}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-slate-300">
            No negotiation events yet
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Submit a human or AI-agent offer to start the
            decision trace.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <article
              key={event.id}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
                    Round {event.roundNumber}
                  </span>

                  <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-400">
                    {event.source === "agent"
                      ? "AI agent"
                      : "Human"}
                  </span>
                </div>

                <span
                  className={`text-xs font-semibold ${
                    event.type === "accepted"
                      ? "text-emerald-300"
                      : event.type === "security" ||
                          event.type === "velocity"
                        ? "text-red-300"
                        : event.type === "rejected"
                          ? "text-orange-300"
                          : "text-cyan-300"
                  }`}
                >
                  {statusLabel(event)}
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">
                    Buyer offer
                  </p>

                  <p className="mt-1 font-semibold text-slate-200">
                    ₹{event.offeredPrice}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Engine price
                  </p>

                  <p className="mt-1 font-semibold text-slate-200">
                    {event.calculatedPrice
                      ? `₹${event.calculatedPrice}`
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-800 pt-4">
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                  Reason
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-300">
                  {event.reason}
                </p>
              </div>

              {event.explanation && (
                <div className="mt-3 rounded-lg bg-slate-900 px-3 py-2.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-violet-400">
                    Explanation
                  </p>

                  <p className="mt-1 text-sm leading-5 text-slate-400">
                    {event.explanation}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

