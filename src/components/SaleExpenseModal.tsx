import React, { useEffect, useRef, useState } from "react";
import Numpad from "./Numpad";

type Props = {
  open: boolean;
  onClose: () => void;
  location: string;
  deviceId: string;
  onSubmit: (p: {
    amount: number;
    note: string;
    kind: string;
    payment_type: string;
  }) => Promise<void> | void;
};

export default function SaleExpenseModal({
  open,
  onClose,
  location,
  deviceId,
  onSubmit,
}: Props) {
  const [mode, setMode] = useState<"customSale" | "expense">("customSale");
  const [paymentType, setPaymentType] = useState<"cash" | "card">("cash");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const firstFocusRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMode("customSale");
      setAmount("");
      setNote("");
      setTimeout(() => firstFocusRef.current?.focus(), 0);
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [open]);

  const press = (k: string) => {
    setAmount((curr) => {
      if (k === "del") return curr.slice(0, -1);
      if (k === "." && curr.includes(".")) return curr;
      return curr + k;
    });
  };

  const amountCash = Math.round(parseInt(amount || "0") || 0);

  async function submit() {
    if (amountCash <= 0) {
      alert("Amount must be > 0");
      return;
    }
    await onSubmit({
      kind: mode,
      payment_type: paymentType,
      amount: amountCash,
      note,
    });
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        open ? "" : "pointer-events-none"
      }`}
      aria-hidden={!open}
      role="dialog"
      aria-modal="true"
    >
      {/* overlay */}
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      {/* full screen panel */}
      <div
        className={`overflow-auto scrollbar-none w-full h-full rounded-none sm:max-w-xl sm:rounded-2xl shadow-xl inset-0 flex flex-col rounded-none 
        bg-slate-100 text-slate-900 dark:bg-slate-900 dark:text-slate-100 transition-transform ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center p-4 border-b border-slate-300 dark:border-slate-700">
          <div className="text-lg font-semibold">Custom</div>
          <button
            onClick={onClose}
            className="ml-auto px-3 py-1 rounded-lg border border-slate-700"
          >
            Close
          </button>
        </div>

        <div className="w-full">
          {/* mode slider */}
          <div className="p-4">
            <div className="w-full flex rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setMode("customSale")}
                className={`px-4 py-2 flex-1 ${
                  mode === "customSale"
                    ? "bg-emerald-400 text-emerald-950"
                    : "bg-slate-100 dark:bg-slate-900"
                }`}
              >
                Sale
              </button>
              <button
                onClick={() => setMode("expense")}
                className={`px-4 py-2 flex-1 ${
                  mode === "expense"
                    ? "bg-rose-400 text-rose-950"
                    : "bg-slate-100 dark:bg-slate-900"
                }`}
              >
                Expense
              </button>
            </div>
          </div>
        </div>

        {/* form */}
        <div className="p-4 grid gap-3">
          <label
            className="block text-sm dark:text-slate-300 text-slate-800"
            htmlFor="se-amount"
          >
            Amount
          </label>
          <input
            id="se-amount"
            ref={firstFocusRef}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            inputMode="decimal"
          />

          <label
            className="block text-sm dark:text-slate-300 text-slate-800"
            htmlFor="se-note"
          >
            Note
          </label>
          <input
            id="se-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
          />

          <div className="mt-2">
            <Numpad onPress={press} />
          </div>
        </div>

        {mode === "customSale" && (
          <div className="p-4">
            <div className="w-full flex rounded-xl border border-slate-300 dark:border-slate-700 mt-3">
              <button
                onClick={() => setPaymentType("cash")}
                className={`px-4 py-2 flex-1 ${
                  paymentType === "cash"
                    ? "bg-emerald-400 text-emerald-950"
                    : "bg-slate-100 dark:bg-slate-900"
                }`}
              >
                Cash
              </button>
              <button
                onClick={() => setPaymentType("card")}
                className={`px-4 py-2 flex-1 ${
                  paymentType === "card"
                    ? "bg-sky-400 text-sky-950"
                    : "bg-slate-100 dark:bg-slate-900"
                }`}
              >
                Card
              </button>
            </div>
          </div>
        )}

        <div className="mt-auto p-4 grid grid-cols-2 gap-2 border-t border-slate-300 dark:border-slate-700">
          <button
            onClick={onClose}
            className="rounded-xl border dark:border-slate-700 dark:bg-slate-900 py-3 "
          >
            Cancel
          </button>
          <button
            onClick={submit}
            className={`rounded-xl py-3 font-semibold active:scale-95 ${
              mode === "customSale"
                ? "bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                : "bg-rose-400 text-rose-950 hover:bg-rose-300"
            }`}
          >
            {mode === "customSale" ? "Log Sale" : "Log Expense"}
          </button>
        </div>
      </div>
    </div>
  );
}
