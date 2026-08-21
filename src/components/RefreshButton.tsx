import { RotateCcw } from "lucide-react";
import { cn } from "../lib/utils";

type Props = {
  onClick: () => void;
  loading?: boolean;
};

export default function RefreshButton({ onClick, loading }: Props) {
  return (
    <button
      aria-label="Refresh"
      onClick={onClick}
      disabled={loading}
      className={cn(
        "p-1 reset-button transition-transform duration-300",
        "hover:rotate-180 active:scale-95 disabled:opacity-50"
      )}
    >
      <RotateCcw
        className={cn(
          "h-5 w-5 text-slate-400",
          loading && "animate-spin text-emerald-400"
        )}
        style={{ animationDirection: "reverse" }}
      />
    </button>
  );
}
