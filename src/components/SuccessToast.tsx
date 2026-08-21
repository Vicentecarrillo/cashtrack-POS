import React, { useEffect } from "react";

type Props = {
  show: boolean;
  message?: string;
};

export default function SuccessToast({ show, message = "Saved!" }: Props) {
  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-[100] pointer-events-none transition-all duration-300 ${
        show
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-4"
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="flex items-center gap-2 bg-emerald-500 text-white px-6 py-3 rounded-full shadow-lg">
        <svg
          className="w-5 h-5 animate-scale-in"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span className="font-semibold">{message}</span>
      </div>
    </div>
  );
}
