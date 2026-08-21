import React from "react";
import { calculatediscount, calculateTotal, type CartItem } from "../cart";
import { currency } from "../currency";

type Props = {
  items: CartItem[];
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  subTotal: number;
  discountInput: string;
  onDiscountInput: (v: string) => void;
  cashInput: string;
  onCashInput: (v: string) => void;
};

export default function Cart({
  items,
  onInc,
  onDec,
  onRemove,
  onClear,
  subTotal,
  discountInput,
  onDiscountInput,
  cashInput,
  onCashInput,
}: Props) {
  const discount = calculatediscount(subTotal, discountInput);
  const total = calculateTotal(subTotal, discount);
  const cash = Math.round(parseInt(cashInput || "0") || 0);
  const change = Math.max(0, cash - total);

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm">Cart</div>
        <button onClick={onClear} className="text-xs">
          Clear
        </button>
      </div>

      {items.length === 0 && (
        <div className="text-sm text-fg-2">
          No items yet. Tap products to add.
        </div>
      )}

      <div className="flex-1">
        {items.map(({ product, qty }) => (
          <div
            key={product.product_id}
            className="flex items-center justify-between py-2 border-b bg-white border-slate-200 dark:border-slate-800 dark:bg-slate-900 last:border-0"
          >
            <div className="mr-2">
              <div className="text-fg-3">{product.name}</div>
              <div className="text-fg-2 text-xs">
                {currency(product.price)} each
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center">
                <button
                  onClick={() => onDec(product.product_id)}
                  className="px-2 py-1 rounded-lg"
                >
                  -
                </button>
                <div className="w-8 text-center">{qty}</div>
                <button
                  onClick={() => onInc(product.product_id)}
                  className="px-2 py-1 rounded-lg"
                >
                  +
                </button>
              </div>

              <div className="w-20 text-right">
                {currency(product.price * qty)}
              </div>
              <button
                onClick={() => onRemove(product.product_id)}
                className="ml-2 text-xs text-rose-400 hover:text-rose-300"
              >
                X
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Totals + discount + cash */}
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-fg-2">Subtotal</span>
          <span className="text-fg-3">{currency(subTotal)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="discount" className="">
            Discount
          </label>
          <div className="relative w-28">
            <input
              id="discount"
              data-testid="discount-input"
              value={discountInput}
              onChange={(e) => onDiscountInput(e.target.value)}
              placeholder="0"
              inputMode="numeric"
              className="w-28 rounded-lg px-2 py-1 text-right pr-5"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-500">
              %
            </span>
          </div>
        </div>
        <div className="flex justify-between">
          <span className="text-fg-2 font-medium text-lg">Total</span>
          <span className="text-fg-3 font-semibold text-lg">
            {currency(total)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="cash" className="text-fg-2">
            Cash
          </label>
          <input
            id="cash"
            value={cashInput}
            onChange={(e) => onCashInput(e.target.value)}
            placeholder="0"
            inputMode="numeric"
            className="w-28 rounded-lg px-2 py-1 text-right"
          />
        </div>
        <div className="flex justify-between">
          <span className="text-fg-2">Change</span>
          <span className="text-fg-3">{currency(change)}</span>
        </div>
      </div>
    </div>
  );
}
