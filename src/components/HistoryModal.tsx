import { useEffect, useMemo, useState } from "react";
import { currency } from "../currency";
import { getAllEvents } from "../db";
import {
  calculateTodayTotal,
  filterHistoryEvents,
} from "../historyUtils";

type HistoryModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function HistoryModal({ open, onClose }: HistoryModalProps) {
  const [historyEvents, setHistoryEvents] = useState<any[]>([]);
  const [historyLimit, setHistoryLimit] = useState(30);
  const [showSales, setShowSales] = useState(true);
  const [showExpenses, setShowExpenses] = useState(true);
  const [showToday, setShowToday] = useState(false);

  useEffect(() => {
    if (!open) return;
    setHistoryLimit(30);
    (async () => {
      const events = await getAllEvents();
      setHistoryEvents(events);
    })();
  }, [open]);

  const filteredHistory = useMemo(
    () =>
      filterHistoryEvents(
        historyEvents,
        { showSales, showExpenses, showToday },
        new Date()
      ),
    [historyEvents, showToday, showSales, showExpenses]
  );

  const historyTodayTotal = useMemo(
    () => calculateTodayTotal(filteredHistory, showToday),
    [filteredHistory, showToday]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full flex-col bg-stone-50 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-semibold">History</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filteredHistory.length} events
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Close
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-3 dark:border-slate-700">
          <button
            onClick={() => setShowSales((curr) => !curr)}
            className={`rounded-full px-4 py-1 text-sm ${
              showSales
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            Sales
          </button>
          <button
            onClick={() => setShowExpenses((curr) => !curr)}
            className={`rounded-full px-4 py-1 text-sm ${
              showExpenses
                ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            Expenses
          </button>
          <button
            onClick={() => setShowToday((curr) => !curr)}
            className={`rounded-full px-4 py-1 text-sm ${
              showToday
                ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            Today
          </button>
          {showToday && (
            <div className="ml-auto rounded-lg bg-slate-100 px-4 py-1 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Today total: {currency(historyTodayTotal)}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs sm:text-sm">
              <thead className="bg-slate-100 text-left text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-2 py-2 font-medium sm:px-4 sm:py-3">
                    Timestamp
                  </th>
                  <th className="px-2 py-2 font-medium sm:px-4 sm:py-3">
                    Type
                  </th>
                  <th className="px-2 py-2 font-medium sm:px-4 sm:py-3">
                    Event ID
                  </th>
                  <th className="px-2 py-2 font-medium sm:px-4 sm:py-3">
                    Line items
                  </th>
                  <th className="px-2 py-2 font-medium sm:px-4 sm:py-3">
                    Total
                  </th>
                  <th className="px-2 py-2 font-medium sm:px-4 sm:py-3">
                    Note
                  </th>
                  <th className="px-2 py-2 font-medium sm:px-4 sm:py-3">
                    Synced
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
                    >
                      No events match the current filters.
                    </td>
                  </tr>
                )}
                {filteredHistory.slice(0, historyLimit).map((evt) => {
                  const lineItems =
                    Array.isArray(evt.line_items) &&
                    evt.line_items.length > 0
                      ? evt.line_items
                          .map(
                            (item: any) =>
                              `${item.name}${
                                item.quantity ? ` x${item.quantity}` : ""
                              }`
                          )
                          .join(", ")
                      : "-";
                  return (
                    <tr
                      key={evt.local_event_id}
                      className={`border-t border-slate-100 dark:border-slate-800 ${
                        evt.kind === "expense"
                          ? "bg-rose-50/60 text-rose-900 dark:bg-rose-900/20 dark:text-rose-100"
                          : "bg-emerald-50/60 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100"
                      }`}
                    >
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        {new Date(evt.ts).toLocaleString()}
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        {evt.kind || "-"}
                      </td>
                      <td className="px-2 py-2 text-xs text-slate-500 dark:text-slate-300 sm:px-4 sm:py-3">
                        {evt.local_event_id}
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        {lineItems}
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        {currency(evt.amount || 0)}
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        {evt.note || "-"}
                      </td>
                      <td className="px-2 py-2 sm:px-4 sm:py-3">
                        <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
                          {evt.synced ? "Synced" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
          {filteredHistory.length > historyLimit && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setHistoryLimit((curr) => curr + 30)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
              >
                Load 30 more
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
