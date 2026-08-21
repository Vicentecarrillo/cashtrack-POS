import type { Product } from "./db";

export type CartItem = { product: Product; qty: number };

export function calculatesubTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.product.price * item.qty, 0);
}

export function calculatediscount(
  subTotal: number,
  discountInput: string | undefined | null
): number {
  const pct = parseFloat(discountInput || "0");
  if (Number.isNaN(pct) || pct <= 0) return 0;
  return Math.round((pct / 100) * subTotal);
}

export function calculateTotal(subtotal: number, discount: number): number {
  return Math.max(0, subtotal - discount);
}
