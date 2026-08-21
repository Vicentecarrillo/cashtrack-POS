import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Cart from "../src/components/Cart";
import type { CartItem } from "../src/cart";

const makeItem = (price: number, qty: number, name = "Item"): CartItem => ({
  product: {
    product_id: `${name}-${price}-${qty}`,
    name,
    price,
    active: true,
  },
  qty,
});

describe("Cart component", () => {
  it("renders computed totals based on inputs", () => {
    const items = [makeItem(500, 2, "Coffee")];
    render(
      <Cart
        items={items}
        onInc={() => {}}
        onDec={() => {}}
        onRemove={() => {}}
        onClear={() => {}}
        subTotal={1000}
        discountInput="10"
        onDiscountInput={() => {}}
        cashInput="1000"
        onCashInput={() => {}}
      />
    );

    expect(screen.getByText("Coffee")).toBeInTheDocument();

    const subtotalRow = screen.getByText("Subtotal").parentElement;
    expect(subtotalRow).not.toBeNull();
    expect(subtotalRow).toHaveTextContent("$1,000");

    const totalRow = screen.getByText("Total").parentElement;
    expect(totalRow).not.toBeNull();
    expect(totalRow).toHaveTextContent("$900");

    const changeRow = screen.getByText("Change").parentElement;
    expect(changeRow).not.toBeNull();
    expect(changeRow).toHaveTextContent("$100");
  });

  it("notifies callers when discount and cash inputs change", async () => {
    const user = userEvent.setup();
    const onDiscountInput = vi.fn((v) => {
      console.log("discount->", v);
    });

    const onCashInput = vi.fn();

    render(
      <Cart
        items={[]}
        onInc={() => {}}
        onDec={() => {}}
        onRemove={() => {}}
        onClear={() => {}}
        subTotal={0}
        discountInput=""
        onDiscountInput={onDiscountInput}
        cashInput=""
        onCashInput={onCashInput}
      />
    );

    const discountField = screen.getByRole("textbox", { name: /discount/i });
    expect(discountField.tagName).toBe("INPUT");
    expect(discountField.id).toBe("discount");
    expect(discountField).not.toBeDisabled();
    expect(discountField).not.toHaveAttribute("readonly");

    fireEvent.input(discountField, { target: { value: "15" } });
    expect(onDiscountInput).toHaveBeenCalled();
    expect(onDiscountInput).toHaveBeenCalledWith("15");

    const cashField = screen.getByRole("textbox", { name: /cash/i });
    fireEvent.input(cashField, { target: { value: "20" } });
    expect(onCashInput).toHaveBeenCalled();
    expect(onCashInput).toHaveBeenLastCalledWith("20");
  });
});
