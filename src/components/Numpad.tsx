import React from "react";

type Props = { onPress: (k: string) => void };

export default function Numpad({ onPress }: Props) {
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "del"];
  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => onPress(k)}
          className="rounded-xl border border-slate-200 dark:border-slate-700 py-4
          text-lg active:scale-95"
        >
          {k === "del" ? "⌫" : k}
        </button>
      ))}
    </div>
  );
}
