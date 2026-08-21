import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SaleExpenseModal from "../src/components/SaleExpenseModal";

describe("SaleExpenseModal", () => {
  it("submits a custom sale with amount and note", async () => {
    const onSubmit = vi.fn();
    render(
      <SaleExpenseModal
        open
        onClose={() => {}}
        location="loc-1"
        deviceId="dev-1"
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "120" },
    });
    fireEvent.change(screen.getByLabelText("Note"), {
      target: { value: "Lunch rush" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Log Sale" }));

    expect(onSubmit).toHaveBeenCalledWith({
      kind: "customSale",
      payment_type: "cash",
      amount: 120,
      note: "Lunch rush",
    });
  });

  it("submits an expense and hides payment buttons", () => {
    const onSubmit = vi.fn();
    render(
      <SaleExpenseModal
        open
        onClose={() => {}}
        location="loc-1"
        deviceId="dev-1"
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Expense" }));
    expect(screen.queryByRole("button", { name: "Cash" })).toBeNull();

    fireEvent.change(screen.getByLabelText("Amount"), {
      target: { value: "45" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Log Expense" }));

    expect(onSubmit).toHaveBeenCalledWith({
      kind: "expense",
      payment_type: "cash",
      amount: 45,
      note: "",
    });
  });

  it("prevents submit when amount is empty", () => {
    const onSubmit = vi.fn();
    const alertSpy = vi
      .spyOn(window, "alert")
      .mockImplementation(() => {});

    render(
      <SaleExpenseModal
        open
        onClose={() => {}}
        location="loc-1"
        deviceId="dev-1"
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Log Sale" }));

    expect(alertSpy).toHaveBeenCalledWith("Amount must be > 0");
    expect(onSubmit).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});
