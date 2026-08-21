// src/components/ThemeToggle.tsx
import * as React from "react";

function applyInitialTheme() {
  try {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia?.(
      "(prefers-color-scheme: dark)"
    )?.matches;
    const isDark = saved ? saved === "dark" : !!prefersDark;
    document.documentElement.classList.toggle("dark", isDark);
  } catch {}
}

export default function ThemeToggle() {
  React.useEffect(() => {
    applyInitialTheme();
  }, []);

  const toggle = React.useCallback(() => {
    const isDark = document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, []);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      title="Toggle theme"
      className="h-9 inline-flex items-center gap-1 rounded-lg border px-2 py-2 text-sm
                 border-slate-300 bg-white text-slate-800 hover:bg-gray-100 dark:hover:bg-slate-800
                 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      {/* Sun (visible in light) */}
      <svg width="16" height="16" viewBox="0 0 24 24" className="dark:hidden">
        <path fill="currentColor" d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z" />
      </svg>
      {/* Moon (visible in dark) */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        className="hidden dark:block"
      >
        <path
          fill="currentColor"
          d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 1 0 9.79 9.79Z"
        />
      </svg>
      <span className="hidden sm:inline">Theme</span>
    </button>
  );
}
