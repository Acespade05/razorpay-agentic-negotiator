"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AIBuyer from "../components/buyer/AIBuyer";

import BuyerModeToggle, {
  BuyerMode,
} from "../components/buyer/BuyerModeToggle";

import ManualBuyer from "../components/buyer/ManualBuyer";

import {
  API_BASE_URL,
  createSessionId,
  NegotiationResponse,
  submitNegotiationStep,
} from "../lib/negotiation";

type JourneySource =
  | "human"
  | "agent";

interface JourneyEvent {
  id: string;
  roundNumber: number;
  offeredPrice: string;
  calculatedPrice: string | null;
  status:
    | "continue"
    | "accepted"
    | "no_deal"
    | "rejected";
  reason: string;
  explanation: string;
  source: JourneySource;
}

interface PaymentLinkView {
  id: string;
  short_url: string;
  status: string;
  created_at?: number;
  expire_by?: number;
  reference_id?: string;
}

function getPaymentLink(
  value: unknown,
): PaymentLinkView | null {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const candidate =
    value as Record<
      string,
      unknown
    >;

  if (
    typeof candidate.id !==
      "string" ||
    typeof candidate.short_url !==
      "string" ||
    typeof candidate.status !==
      "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    short_url:
      candidate.short_url,
    status:
      candidate.status,
    created_at:
      typeof candidate.created_at ===
      "number"
        ? candidate.created_at
        : undefined,
    expire_by:
      typeof candidate.expire_by ===
      "number"
        ? candidate.expire_by
        : undefined,
    reference_id:
      typeof candidate.reference_id ===
      "string"
        ? candidate.reference_id
        : undefined,
  };
}

function statusLabel(
  status: JourneyEvent["status"],
): string {
  if (
    status ===
    "no_deal"
  ) {
    return "No deal";
  }

  if (
    status ===
    "rejected"
  ) {
    return "Rejected";
  }

  if (
    status ===
    "accepted"
  ) {
    return "Accepted";
  }

  return "Counter";
}

function statusClass(
  status: JourneyEvent["status"],
): string {
  if (
    status ===
    "accepted"
  ) {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  }

  if (
    status ===
      "no_deal" ||
    status ===
      "rejected"
  ) {
    return "border-red-400/30 bg-red-400/10 text-red-300";
  }

  return "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";
}

export default function Home() {
  const [
    mode,
    setMode,
  ] = useState<BuyerMode>(
    "manual",
  );

  const [
    sessionId,
    setSessionId,
  ] = useState("");

  const [
    quantity,
    setQuantity,
  ] = useState("10");

  const [
    humanOffer,
    setHumanOffer,
  ] = useState("90");

  const [
    productName,
    setProductName,
  ] = useState(
    "Enterprise Widget",
  );

  const [
    listPrice,
    setListPrice,
  ] = useState(
    "100.00",
  );

  const [
    availableStock,
    setAvailableStock,
  ] = useState<
    number | null
  >(null);

  const [
    response,
    setResponse,
  ] =
    useState<NegotiationResponse | null>(
      null,
    );

  const [
    journey,
    setJourney,
  ] = useState<JourneyEvent[]>(
    [],
  );

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const sessionLabel =
    useMemo(() => {
      if (!sessionId) {
        return "Creating session…";
      }

      return `${sessionId.slice(
        0,
        8,
      )}…`;
    }, [sessionId]);

  const paymentLink =
    getPaymentLink(
      response?.payment_link,
    );

  const paymentSectionRef =
    useRef<HTMLElement | null>(null);

  useEffect(() => {
    const newSessionId =
      createSessionId();

    setSessionId(
      newSessionId,
    );

    async function loadProduct() {
      try {
        const productResponse =
          await fetch(
            `${API_BASE_URL}/api/product`,
          );

        if (
          !productResponse.ok
        ) {
          throw new Error(
            "Could not load product information.",
          );
        }

        const productData =
          (await productResponse.json()) as {
            name: string;
            list_price_per_unit: string;
            stock: number;
          };

        setProductName(
          productData.name,
        );

        setListPrice(
          productData.list_price_per_unit,
        );

        setAvailableStock(
          productData.stock,
        );
      } catch (
        productError
      ) {
        console.error(
          productError,
        );

        setError(
          "Could not load product information. Make sure FastAPI is running on port 8000.",
        );
      }
    }

    void loadProduct();
  }, []);

  useEffect(() => {
    if (!paymentLink) {
      return;
    }

    const timeoutId =
      window.setTimeout(() => {
        paymentSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [paymentLink]);

  function resetSession() {
    setSessionId(
      createSessionId(),
    );

    setMode("manual");

    setQuantity("10");

    setHumanOffer("90");

    setResponse(null);

    setJourney([]);

    setError("");

    setLoading(false);
  }

  function appendJourneyEvent(
    nextResponse: NegotiationResponse,
    source: JourneySource,
  ) {
    const event: JourneyEvent = {
      id: `${nextResponse.session_id}-${nextResponse.round_number}-${Date.now()}`,
      roundNumber:
        nextResponse.round_number,
      offeredPrice:
        nextResponse.offered_price_per_unit,
      calculatedPrice:
        nextResponse.calculated_price,
      status:
        nextResponse.status,
      reason:
        nextResponse.reason,
      explanation:
        nextResponse.explanation,
      source,
    };

    setJourney(
      (current) => [
        ...current,
        event,
      ],
    );
  }

  async function submitPayload(
    payload: {
      session_id: string;
      quantity: number;
      offered_price_per_unit: string;
    },
    source: JourneySource,
  ): Promise<NegotiationResponse | null> {
    setLoading(true);
    setError("");

    try {
      const result =
        await submitNegotiationStep(
          payload,
        );

      if (!result.ok) {
        const rejectionEvent: JourneyEvent =
          {
            id: `error-${Date.now()}`,
            roundNumber:
              response?.round_number ??
              0,
            offeredPrice:
              payload.offered_price_per_unit,
            calculatedPrice:
              null,
            status:
              "rejected",
            reason:
              result.message,
            explanation:
              result.message,
            source,
          };

        setJourney(
          (current) => [
            ...current,
            rejectionEvent,
          ],
        );

        setError(
          `${result.code}: ${result.message}`,
        );

        return null;
      }

      setResponse(
        result.data,
      );

      appendJourneyEvent(
        result.data,
        source,
      );

      return result.data;
    } catch (
      requestError
    ) {
      console.error(
        requestError,
      );

      setError(
        "Could not reach the negotiation backend. Make sure FastAPI is running on port 8000.",
      );

      return null;
    } finally {
      setLoading(false);
    }
  }

  async function handleManualSubmit(
    quantityValue: number,
    offer: string,
  ) {
    if (
      availableStock !== null &&
      quantityValue >
        availableStock
    ) {
      setError(
        `Only ${availableStock} units are currently available.`,
      );

      return;
    }

    await submitPayload(
      {
        session_id:
          sessionId,
        quantity:
          quantityValue,
        offered_price_per_unit:
          offer,
      },
      "human",
    );
  }

  async function handleAgentSubmit(
    quantityValue: number,
    offer: string,
  ): Promise<NegotiationResponse | null> {
    if (
      availableStock !== null &&
      quantityValue >
        availableStock
    ) {
      setError(
        `Only ${availableStock} units are currently available.`,
      );

      return null;
    }

    return submitPayload(
      {
        session_id:
          sessionId,
        quantity:
          quantityValue,
        offered_price_per_unit:
          offer,
      },
      "agent",
    );
  }

  const latestResponse =
    response;

  const totalValue =
    latestResponse
      ? (
          Number(
            latestResponse.calculated_price,
          ) *
          latestResponse.quantity
        ).toFixed(2)
      : null;

  const isAccepted =
    latestResponse?.status ===
    "accepted";

  const isNoDeal =
    latestResponse?.status ===
    "no_deal";

  const isTerminal =
    isAccepted ||
    isNoDeal;

  const publicEngineDecision =
    isNoDeal
      ? `No deal: buyer's maximum budget of ₹${latestResponse?.buyer_effective_max ?? latestResponse?.offered_price_per_unit} does not meet our commercial viability threshold for this tier.`
      : latestResponse?.reason ?? "";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1450px] px-5 py-4 lg:px-7">
        {/* HEADER */}
        <header className="mb-4 flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                Live negotiation engine
              </span>

              <span className="text-xs text-slate-600">
                Session{" "}
                {sessionLabel}
              </span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              AI Negotiator
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manual or autonomous negotiation,
              powered by the same deterministic engine.
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="/merchant"
              className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/15"
            >
              Merchant Dashboard
            </a>

            <button
              type="button"
              onClick={
                resetSession
              }
              className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
            >
              New negotiation
            </button>
          </div>
        </header>

        {/* ERROR */}
        {error && (
          <div
            role="alert"
            className="mb-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-200"
          >
            {error}
          </div>
        )}

        {/* MODE TOGGLE */}
        <BuyerModeToggle
          mode={mode}
          onChange={
            setMode
          }
        />

        {/* ===================================================== */}
        {/* DASHBOARD GRID                                        */}
        {/* ===================================================== */}

        <div className="mt-3 grid items-start gap-3 xl:grid-cols-[1.45fr_0.85fr]">
          {/* =================================================== */}
          {/* LEFT COLUMN                                         */}
          {/* =================================================== */}

          <div className="min-w-0">
            {/* BUYER CONTROLS */}
            {isTerminal ? (
              <section
                className={`rounded-2xl border px-5 py-5 shadow-2xl shadow-black/20 ${
                  isAccepted
                    ? "border-emerald-400/30 bg-emerald-400/[0.04]"
                    : "border-red-400/30 bg-red-400/[0.04]"
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p
                      className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${
                        isAccepted
                          ? "text-emerald-300"
                          : "text-red-300"
                      }`}
                    >
                      Session concluded
                    </p>

                    <h2 className="mt-1 text-xl font-semibold">
                      {isAccepted
                        ? "Deal finalized"
                        : "Negotiation closed"}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      This negotiation is finished. Start a new negotiation to make another offer.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={resetSession}
                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
                  >
                    New negotiation
                  </button>
                </div>
              </section>
            ) : mode ===
            "manual" ? (
              <ManualBuyer
                quantity={
                  quantity
                }
                offer={
                  humanOffer
                }
                productName={
                  productName
                }
                listPrice={
                  listPrice
                }
                availableStock={
                  availableStock
                }
                loading={
                  loading
                }
                sessionId={
                  sessionId
                }
                onQuantityChange={
                  setQuantity
                }
                onOfferChange={
                  setHumanOffer
                }
                onSubmit={
                  handleManualSubmit
                }
                onError={
                  setError
                }
              />
            ) : (
              <AIBuyer
                key={
                  sessionId
                }
                sessionId={
                  sessionId
                }
                quantity={
                  quantity
                }
                productName={
                  productName
                }
                listPrice={
                  listPrice
                }
                availableStock={
                  availableStock
                }
                loading={
                  loading
                }
                onQuantityChange={
                  setQuantity
                }
                onSubmit={
                  handleAgentSubmit
                }
                onError={
                  setError
                }
                disabled={
                  isTerminal
                }
              />
            )}

            {/* ================================================= */}
            {/* COMPACT ROUND SUMMARY                             */}
            {/* ================================================= */}

            <section className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-300">
                    Negotiation summary
                  </p>

                  <h2 className="mt-0.5 text-lg font-semibold">
                    Offer → engine response
                  </h2>
                </div>

                <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] text-slate-500">
                  {journey.length}{" "}
                  round
                  {journey.length ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>

              {journey.length ===
              0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-4 text-sm text-slate-600">
                  Rounds will appear here after the first offer.
                </div>
              ) : (
                <div className="overflow-x-auto pb-2">
                  <div className="flex min-w-max gap-2">
                    {journey.map(
                    (
                      event,
                    ) => (
                      <div
                        key={
                          event.id
                        }
                        className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-200">
                            Round{" "}
                            {
                              event.roundNumber
                            }
                          </span>

                          <span
                            className={`rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${statusClass(
                              event.status,
                            )}`}
                          >
                            {statusLabel(
                              event.status,
                            )}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[9px] uppercase tracking-widest text-slate-600">
                              Buyer
                            </p>

                            <p className="mt-1 text-sm font-bold">
                              ₹
                              {
                                event.offeredPrice
                              }
                            </p>
                          </div>

                          <span className="text-slate-700">
                            →
                          </span>

                          <div className="text-right">
                            <p className="text-[9px] uppercase tracking-widest text-slate-600">
                              Engine
                            </p>

                            <p className="mt-1 text-sm font-bold">
                              {event.calculatedPrice
                                ? `₹${event.calculatedPrice}`
                                : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ),
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* ================================================= */}
            {/* NEGOTIATION JOURNEY + REASONING                   */}
            {/* ================================================= */}

            <section className="mt-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="mb-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  Negotiation journey
                </p>

                <h2 className="mt-0.5 text-lg font-semibold">
                  Why each decision happened
                </h2>
              </div>

              {journey.length ===
              0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-5 text-sm text-slate-600">
                  The AI copywriter&apos;s explanation for each round will
                  appear here.
                </div>
              ) : (
                <div className="space-y-2">
                  {journey.map(
                    (
                      event,
                    ) => (
                      <div
                        key={
                          event.id
                        }
                        className="rounded-xl border border-slate-800 bg-slate-950 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-200">
                              Round{" "}
                              {
                                event.roundNumber
                              }
                            </span>

                            <span className="rounded-full bg-slate-800 px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                              {event.source ===
                              "agent"
                                ? "AI buyer"
                                : "Manual buyer"}
                            </span>
                          </div>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide ${statusClass(
                              event.status,
                            )}`}
                          >
                            {statusLabel(
                              event.status,
                            )}
                          </span>
                        </div>

                        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2.5">
                          <p className="text-[9px] font-semibold uppercase tracking-widest text-violet-300">
                            AI explanation
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {
                              event.explanation
                            }
                          </p>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </section>
          </div>

          {/* =================================================== */}
          {/* RIGHT COLUMN                                        */}
          {/* =================================================== */}

          <aside className="flex min-w-0 flex-col gap-3">
            {/* NEGOTIATION SIGNAL */}
            <section
              className={`rounded-2xl border p-5 shadow-2xl shadow-black/20 ${
                isAccepted
                  ? "border-emerald-400/30 bg-emerald-400/[0.04]"
                  : isNoDeal
                    ? "border-red-400/30 bg-red-400/[0.04]"
                    : "border-slate-800 bg-slate-900/70"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Negotiation signal
                  </p>

                  <h2 className="mt-1.5 text-2xl font-bold">
                    {!latestResponse
                      ? "Ready"
                      : isAccepted
                        ? "Agreement reached"
                        : isNoDeal
                          ? "No deal"
                          : "Counter-offer"}
                  </h2>
                </div>

                <span
                  className={`rounded-full border px-3 py-1 text-[10px] font-semibold ${
                    isAccepted
                      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                      : isNoDeal
                        ? "border-red-400/30 bg-red-400/10 text-red-300"
                        : "border-slate-700 bg-slate-950 text-slate-500"
                  }`}
                >
                  {mode ===
                  "agent"
                    ? "AI buyer"
                    : "Manual buyer"}
                </span>
              </div>

              {latestResponse ? (
                <>
                  <div className="mt-5">
                    <p className="text-[11px] uppercase tracking-widest text-slate-500">
                      Current price
                    </p>

                    <div className="mt-1 flex items-end justify-between gap-3">
                      <p className="text-4xl font-bold tracking-tight">
                        ₹
                        {
                          latestResponse.calculated_price
                        }
                        <span className="ml-1 text-base font-normal text-slate-500">
                          /unit
                        </span>
                      </p>

                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-slate-600">
                          Total
                        </p>

                        <p className="text-xl font-bold text-emerald-300">
                          ₹
                          {
                            totalValue
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-slate-950 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-slate-600">
                        Round
                      </p>

                      <p className="mt-1 text-sm font-semibold">
                        {
                          latestResponse.round_number
                        }{" "}
                        /{" "}
                        {
                          latestResponse.max_rounds
                        }
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-950 p-3">
                      <p className="text-[9px] uppercase tracking-widest text-slate-600">
                        Quantity
                      </p>

                      <p className="mt-1 text-sm font-semibold">
                        {
                          latestResponse.quantity
                        }
                      </p>
                    </div>

                    {!isNoDeal && (
                      <div className="rounded-xl bg-slate-950 p-3">
                        <p className="text-[9px] uppercase tracking-widest text-slate-600">
                          Floor
                        </p>

                        <p className="mt-1 text-sm font-semibold">
                          ₹
                          {
                            latestResponse.floor_price_per_unit
                          }
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                      Engine decision
                    </p>

                    <p className="mt-1.5 text-sm leading-5 text-slate-400">
                      {
                        publicEngineDecision
                      }
                    </p>
                  </div>
                </>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4">
                  <p className="text-sm leading-5 text-slate-500">
                    Submit your first offer to receive the
                    live engine signal.
                  </p>
                </div>
              )}
            </section>

            {/* PAYMENT */}
            <section
              ref={paymentSectionRef}
              className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Payment
                  </p>

                  <h2 className="mt-1 text-lg font-semibold">
                    {paymentLink
                      ? "Payment ready"
                      : "Awaiting agreement"}
                  </h2>
                </div>

                {paymentLink && (
                  <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-amber-300">
                    Test Mode
                  </span>
                )}
              </div>

              {paymentLink ? (
                <>
                  <div className="mt-4 rounded-xl bg-slate-950 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-500">
                        Agreed unit price
                      </span>

                      <span className="font-semibold">
                        ₹
                        {
                          latestResponse?.calculated_price
                        }
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                      <span className="text-sm text-slate-500">
                        Quantity
                      </span>

                      <span className="font-semibold">
                        {
                          latestResponse?.quantity
                        }
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                      <span className="text-sm text-slate-500">
                        Total
                      </span>

                      <span className="text-lg font-bold text-emerald-300">
                        ₹
                        {
                          totalValue
                        }
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-800 pt-3">
                      <span className="text-sm text-slate-500">
                        Status
                      </span>

                      <span className="font-semibold text-emerald-300">
                        {
                          paymentLink.status
                        }
                      </span>
                    </div>
                  </div>

                  <a
                    href={
                      paymentLink.short_url
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 block rounded-xl bg-emerald-400 px-5 py-3 text-center text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
                  >
                    Open Razorpay Test Payment ↗
                  </a>

                  <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">
                      Demo verification note
                    </p>

                    <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
                      This is a Razorpay Test Mode payment
                      link. Opening it does not verify
                      payment. Verified payment requires a
                      verified callback/webhook.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-4">
                    <p className="text-sm leading-5 text-slate-500">
                      A short-lived Razorpay Test Mode payment
                      link is created after the deterministic
                      engine accepts the negotiation.
                    </p>
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-950 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                      Flow
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Negotiate → Accept → Generate payment
                      link
                    </p>
                  </div>
                </>
              )}
            </section>
          </aside>
        </div>

        {/* FOOTER */}
        <footer className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3 text-[10px] text-slate-700">
          <span>
            Buyer offers → Deterministic engine → Payment
          </span>

          <span>
            Merchant price authority stays in the backend
          </span>
        </footer>
      </div>
    </main>
  );
}