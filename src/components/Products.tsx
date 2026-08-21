import React from "react";
import { Product } from "../db";
import { currency } from "../currency";

type Props = {
  location: string;
  products: Product[];
  loading: boolean;
  error: string | null;
  onSelect?: (p: Product) => void;
  itemsInCart: boolean;
  search: string;
};

function normalizeCategory(c?: string) {
  const v = (c || "").trim();
  return v.length ? v : "Uncategorized";
}

export default function Products({
  location,
  products,
  loading,
  error,
  onSelect,
  itemsInCart,
  search,
}: Props) {
  // Persist selected category per location
  const storageKey = React.useMemo(() => `pos:cat:${location}`, [location]);
  const [selected, setSelected] = React.useState<string>(() => {
    try {
      return localStorage.getItem(storageKey) || "All";
    } catch {
      return "All";
    }
  });
  React.useEffect(() => {
    try {
      localStorage.setItem(storageKey, selected);
    } catch {}
  }, [storageKey, selected]);

  // Build categories
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of products) set.add(normalizeCategory(p.category));
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    return ["All", ...list];
  }, [products]);

  // Filter products by category and search
  const visible = React.useMemo(() => {
    return products.filter((p) => {
      const inCategory =
        selected === "All" || normalizeCategory(p.category) === selected;

      const inSearch =
        !search || p.name.toLowerCase().includes(search.toLowerCase());

      return inCategory && inSearch;
    });
  }, [products, selected, search]);

  // Scroll the grid back to top when category changes
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    gridRef.current?.scrollTo({
      top: 0,
      behavior: "instant" as ScrollBehavior,
    });
  }, [selected]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col gap-2">
      {/* Filter bar (hidden if no categories) */}
      {categories.length > 1 && (
        <div className="scrollbar-none overflow-auto flex gap-2 overflow-auto pb-1 -mx-1 px-1">
          {categories.map((cat) => {
            const isActive = cat === selected;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={isActive}
                onClick={() => setSelected(cat)}
                className={
                  isActive
                    ? "inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium " +
                      "bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                    : "pill hover:bg-gray-100 dark:hover:bg-slate-800"
                }
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Status */}
      {loading && products.length === 0 && (
        <div className="text-fg-3 text-sm">Loading products…</div>
      )}
      {error && products.length === 0 && (
        <div className="text-rose-500 text-sm">
          Failed to load products: {error}
        </div>
      )}
      {visible.length === 0 && !loading && (
        <div className="text-fg-3 text-sm">
          No products in “{selected}” for this register.
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          ref={gridRef}
          className={`scrollbar-none overflow-auto grid grid-cols-2 sm:grid-cols-3 gap-2 ${
            itemsInCart ? "pb-16" : ""
          } md:pb-0`}
        >
          {visible.map((p) => (
            <button
              key={p.product_id}
              onClick={() => onSelect?.(p)}
              className="rounded-xl px-3 py-3 text-left active:scale-95"
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-sm">{currency(p.price)}</div>
              {p.category && (
                <div className="mt-1 text-xs text-fg-3">
                  {normalizeCategory(p.category)}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
