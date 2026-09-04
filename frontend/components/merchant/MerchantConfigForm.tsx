"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";

interface MerchantConfig {
  p_list: string;
  floor_1_9: string;
  floor_10_49: string;
  floor_50_99: string;
  floor_100_plus: string;
  alpha: string;
  max_rounds: number;
}

interface MerchantConfigFormProps {
  onListPriceChange?: (
    value: string,
  ) => void;
}

function isPositiveMoney(
  value: string,
): boolean {
  const parsed = Number(value);

  return (
    Number.isFinite(parsed) &&
    parsed > 0
  );
}

export default function MerchantConfigForm({
  onListPriceChange,
}: MerchantConfigFormProps) {
  const [config, setConfig] =
    useState<MerchantConfig>({
      p_list: "100.00",
      floor_1_9: "90.00",
      floor_10_49: "88.00",
      floor_50_99: "85.00",
      floor_100_plus: "80.00",
      alpha: "1.5",
      max_rounds: 5,
    });

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const loadConfig =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/merchant/config`,
          );

        if (!response.ok) {
          throw new Error(
            "Unable to load merchant configuration.",
          );
        }

        const data =
          (await response.json()) as MerchantConfig;

        setConfig(data);

        onListPriceChange?.(
          data.p_list,
        );
      } catch (
        configError
      ) {
        console.error(
          configError,
        );

        setError(
          "Could not load merchant configuration. Make sure FastAPI is running on port 8000.",
        );
      } finally {
        setLoading(false);
      }
    }, [onListPriceChange]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  function updateField(
    field: keyof MerchantConfig,
    value: string | number,
  ) {
    setConfig(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );

    if (field === "p_list") {
      onListPriceChange?.(
        String(value),
      );
    }

    setMessage("");
    setError("");
  }

  function validate(): string | null {
    if (
      !isPositiveMoney(
        config.p_list,
      )
    ) {
      return "List price must be greater than zero.";
    }

    const floors = [
      {
        name: "1–9 floor",
        value: config.floor_1_9,
      },
      {
        name: "10–49 floor",
        value: config.floor_10_49,
      },
      {
        name: "50–99 floor",
        value: config.floor_50_99,
      },
      {
        name: "100+ floor",
        value: config.floor_100_plus,
      },
    ];

    for (const floor of floors) {
      if (
        !isPositiveMoney(
          floor.value,
        )
      ) {
        return `${floor.name} must be greater than zero.`;
      }

      if (
        Number(floor.value) >
        Number(config.p_list)
      ) {
        return `${floor.name} cannot exceed the list price.`;
      }
    }

    if (
      Number(config.floor_1_9) <
      Number(config.floor_10_49)
    ) {
      return "Quantity floors must not increase as quantity increases.";
    }

    if (
      Number(config.floor_10_49) <
      Number(config.floor_50_99)
    ) {
      return "Quantity floors must not increase as quantity increases.";
    }

    if (
      Number(config.floor_50_99) <
      Number(config.floor_100_plus)
    ) {
      return "Quantity floors must not increase as quantity increases.";
    }

    const alpha =
      Number(config.alpha);

    if (
      !Number.isFinite(alpha) ||
      alpha <= 0
    ) {
      return "Alpha must be greater than zero.";
    }

    const maxRounds =
      Number(config.max_rounds);

    if (
      !Number.isInteger(
        maxRounds,
      ) ||
      maxRounds < 2
    ) {
      return "Maximum rounds must be at least 2.";
    }

    return null;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const validationError =
      validate();

    if (validationError) {
      setError(
        validationError,
      );
      setMessage("");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response =
        await fetch(
          `${API_BASE_URL}/api/merchant/config`,
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              p_list:
                config.p_list,
              floor_1_9:
                config.floor_1_9,
              floor_10_49:
                config.floor_10_49,
              floor_50_99:
                config.floor_50_99,
              floor_100_plus:
                config.floor_100_plus,
              alpha:
                config.alpha,
              max_rounds:
                config.max_rounds,
            }),
          },
        );

      const data =
        (await response.json()) as {
          message?: string;
          config?: MerchantConfig;
          detail?: unknown;
        };

      if (!response.ok) {
        const backendMessage =
          typeof data.detail ===
          "string"
            ? data.detail
            : "The backend rejected this configuration.";

        throw new Error(
          backendMessage,
        );
      }

      if (data.config) {
        setConfig(
          data.config,
        );

        onListPriceChange?.(
          data.config.p_list,
        );
      }

      setMessage(
        data.message ??
          "Merchant configuration updated successfully.",
      );
    } catch (
      saveError
    ) {
      console.error(
        saveError,
      );

      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save merchant configuration.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
        <p className="text-sm text-slate-400">
          Loading merchant configuration…
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl shadow-black/20">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300">
          Pricing configuration
        </p>

        <h2 className="mt-2 text-2xl font-semibold">
          Merchant negotiation rules
        </h2>

        <p className="mt-1 text-sm leading-6 text-slate-400">
          These values control the merchant-side
          deterministic pricing engine at runtime.
          The backend remains authoritative.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm leading-6 text-red-200"
        >
          {error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="mb-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-200"
        >
          {message}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <div>
          <label
            htmlFor="p-list"
            className="mb-2 block text-sm font-medium text-slate-300"
          >
            List price per unit
          </label>

          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              ₹
            </span>

            <input
              id="p-list"
              type="text"
              inputMode="decimal"
              value={config.p_list}
              onChange={(event) =>
                updateField(
                  "p_list",
                  event.target.value,
                )
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-9 pr-4 text-slate-100 outline-none transition focus:border-amber-400"
            />
          </div>
        </div>

        <div>
          <p className="mb-3 text-sm font-medium text-slate-300">
            Quantity-based floor prices
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="floor-1-9"
                className="mb-2 block text-xs text-slate-500"
              >
                1–9 units
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  ₹
                </span>

                <input
                  id="floor-1-9"
                  type="text"
                  inputMode="decimal"
                  value={
                    config.floor_1_9
                  }
                  onChange={(event) =>
                    updateField(
                      "floor_1_9",
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-9 pr-4 text-slate-100 outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="floor-10-49"
                className="mb-2 block text-xs text-slate-500"
              >
                10–49 units
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  ₹
                </span>

                <input
                  id="floor-10-49"
                  type="text"
                  inputMode="decimal"
                  value={
                    config.floor_10_49
                  }
                  onChange={(event) =>
                    updateField(
                      "floor_10_49",
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-9 pr-4 text-slate-100 outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="floor-50-99"
                className="mb-2 block text-xs text-slate-500"
              >
                50–99 units
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  ₹
                </span>

                <input
                  id="floor-50-99"
                  type="text"
                  inputMode="decimal"
                  value={
                    config.floor_50_99
                  }
                  onChange={(event) =>
                    updateField(
                      "floor_50_99",
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-9 pr-4 text-slate-100 outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="floor-100-plus"
                className="mb-2 block text-xs text-slate-500"
              >
                100+ units
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  ₹
                </span>

                <input
                  id="floor-100-plus"
                  type="text"
                  inputMode="decimal"
                  value={
                    config.floor_100_plus
                  }
                  onChange={(event) =>
                    updateField(
                      "floor_100_plus",
                      event.target.value,
                    )
                  }
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-9 pr-4 text-slate-100 outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs leading-5 text-slate-500">
            Floors must stay at or below list price and
            may only decrease as quantity increases.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="alpha"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Concession curve α
            </label>

            <input
              id="alpha"
              type="text"
              inputMode="decimal"
              value={config.alpha}
              onChange={(event) =>
                updateField(
                  "alpha",
                  event.target.value,
                )
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-amber-400"
            />

            <p className="mt-2 text-xs text-slate-500">
              Controls the shape of the deterministic
              concession curve.
            </p>
          </div>

          <div>
            <label
              htmlFor="max-rounds"
              className="mb-2 block text-sm font-medium text-slate-300"
            >
              Maximum negotiation rounds
            </label>

            <input
              id="max-rounds"
              type="number"
              min="2"
              step="1"
              value={config.max_rounds}
              onChange={(event) =>
                updateField(
                  "max_rounds",
                  Number(
                    event.target.value,
                  ),
                )
              }
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none focus:border-amber-400"
            />

            <p className="mt-2 text-xs text-slate-500">
              The current project uses five rounds by
              default.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
          <p className="text-sm font-semibold text-amber-200">
            Important
          </p>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            Changing these values changes the merchant
            pricing policy used by new negotiation turns.
            The deterministic backend engine still enforces
            the actual rules.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-amber-300 px-4 py-3 font-bold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving configuration…"
              : "Save pricing configuration"}
          </button>

          <a
            href="/"
            className="flex w-full items-center justify-center rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"
          >
            Open Buyer Experience
          </a>
        </div>

        {message && (
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
            <p className="text-sm font-semibold text-emerald-200">
              Configuration is live
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-400">
              Start a new buyer negotiation to see
              these merchant rules applied by the
              backend pricing engine.
            </p>
          </div>
        )}
      </form>
    </section>
  );
}