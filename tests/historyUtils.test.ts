import { describe, expect, it } from "vitest";
import {
  calculateTodayTotal,
  filterHistoryEvents,
} from "../src/historyUtils";

describe("filterHistoryEvents", () => {
  const referenceDate = new Date("2024-04-10T12:00:00Z");
  const events = [
    {
      kind: "sale",
      ts: "2024-04-10T11:00:00Z",
      amount: 100,
    },
    {
      kind: "customSale",
      ts: "2024-04-10T10:00:00Z",
      amount: 50,
    },
    {
      kind: "expense",
      ts: "2024-04-09T18:00:00Z",
      amount: 25,
    },
  ];

  it("includes customSale when sales filter is enabled", () => {
    const result = filterHistoryEvents(
      events,
      { showSales: true, showExpenses: false, showToday: false },
      referenceDate
    );
    expect(result.map((evt) => evt.kind)).toEqual(["sale", "customSale"]);
  });

  it("excludes sales when sales filter is disabled", () => {
    const result = filterHistoryEvents(
      events,
      { showSales: false, showExpenses: true, showToday: false },
      referenceDate
    );
    expect(result.map((evt) => evt.kind)).toEqual(["expense"]);
  });

  it("filters to today when today filter is enabled", () => {
    const result = filterHistoryEvents(
      events,
      { showSales: true, showExpenses: true, showToday: true },
      referenceDate
    );
    expect(result.map((evt) => evt.kind)).toEqual([
      "sale",
      "customSale",
    ]);
  });
});

describe("calculateTodayTotal", () => {
  it("sums sales and custom sales and subtracts expenses", () => {
    const total = calculateTodayTotal(
      [
        { kind: "sale", ts: "2024-04-10T11:00:00Z", amount: 100 },
        { kind: "customSale", ts: "2024-04-10T10:00:00Z", amount: 50 },
        { kind: "expense", ts: "2024-04-10T09:00:00Z", amount: 20 },
      ],
      true
    );
    expect(total).toBe(130);
  });
});
