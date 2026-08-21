import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Unmount React trees after each test to avoid cross-test leakage
afterEach(() => {
  cleanup();
  // optional: reset spies too
  vi.clearAllMocks();
});
