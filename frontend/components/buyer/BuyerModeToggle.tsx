"use client";

export type BuyerMode =
  | "manual"
  | "agent";

interface BuyerModeToggleProps {
  mode: BuyerMode;
  onChange: (mode: BuyerMode) => void;
}

export default function BuyerModeToggle({
  mode,
  onChange,
}: BuyerModeToggleProps) {
  return (
    <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-2 shadow-2xl shadow-black/20">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={mode === "manual"}
          onClick={() => onChange("manual")}
          className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
            mode === "manual"
              ? "bg-cyan-400 text-slate-950"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          👤 Manual buyer
        </button>

        <button
          type="button"
          aria-pressed={mode === "agent"}
          onClick={() => onChange("agent")}
          className={`rounded-xl px-4 py-3 text-sm font-bold transition ${
            mode === "agent"
              ? "bg-violet-400 text-slate-950"
              : "text-slate-300 hover:bg-slate-800"
          }`}
        >
          🤖 AI buyer agent
        </button>
      </div>
    </section>
  );
}