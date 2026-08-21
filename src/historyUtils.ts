export type HistoryEvent = {
  local_event_id?: string;
  kind?: string;
  ts: string;
  amount?: number;
  note?: string;
  synced?: number | boolean;
  line_items?: Array<{
    name?: string;
    quantity?: number;
  }>;
};

type HistoryFilterOptions = {
  showSales: boolean;
  showExpenses: boolean;
  showToday: boolean;
};

const SALE_KINDS = new Set(["sale", "customSale"]);

export function isSaleKind(kind?: string) {
  if (!kind) return false;
  return SALE_KINDS.has(kind);
}

export function filterHistoryEvents(
  events: HistoryEvent[],
  { showSales, showExpenses, showToday }: HistoryFilterOptions,
  referenceDate: Date = new Date()
) {
  const startOfToday = new Date(referenceDate);
  startOfToday.setHours(0, 0, 0, 0);
  return events
    .filter((evt) => {
      if (showToday) {
        const eventTime = new Date(evt.ts);
        if (Number.isNaN(eventTime.getTime()) || eventTime < startOfToday) {
          return false;
        }
      }
      if (isSaleKind(evt.kind) && !showSales) return false;
      if (evt.kind === "expense" && !showExpenses) return false;
      return true;
    })
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
}

export function calculateTodayTotal(
  filteredEvents: HistoryEvent[],
  showToday: boolean
) {
  if (!showToday) return 0;
  return filteredEvents.reduce((total, evt) => {
    if (evt.kind === "expense") return total - (evt.amount ?? 0);
    return total + (evt.amount ?? 0);
  }, 0);
}
