import { describe, expect, it } from "vitest";
import {
  calculatediscount,
  calculatesubTotal,
  calculateTotal,
  type CartItem,
} from "../src/cart";

const makeItem = (price: number, qty: number): CartItem => ({
  product: {
    product_id: `${price}-${qty}`,
    name: "Test",
    price,
    active: true,
  },
  qty,
});

describe("cart math helpers", () => {
  it("adds product line totals for the subtotal", () => {
    const items = [makeItem(100, 2), makeItem(250, 3)];
    expect(calculatesubTotal(items)).toBe(100 * 2 + 250 * 3);
  });

  it("returns zero for an empty cart subtotal", () => {
    expect(calculatesubTotal([])).toBe(0);
  });

  it("treats empty discount input as no discount", () => {
    expect(calculatediscount(1000, "")).toBe(0);
  });

  it("rounds percentage discounts to the nearest cent", () => {
    expect(calculatediscount(999, "12.5")).toBe(125);
  });

  it("ignores non-numeric discount input", () => {
    expect(calculatediscount(1000, "abc")).toBe(0);
  });

  it("ignores negative discount input", () => {
    expect(calculatediscount(1000, "-10")).toBe(0);
  });

  it("subtracts the discount from the total", () => {
    expect(calculateTotal(1000, 250)).toBe(750);
  });

  it("never returns a negative total", () => {
    expect(calculateTotal(1000, 1500)).toBe(0);
  });
});
