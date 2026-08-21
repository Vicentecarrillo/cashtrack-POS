import { getCachedProducts, setMeta, getMeta } from "./db";
import type { Product } from "./db";

function collectlocationsFrom(items: Array<{ location_visibility?: string }>) {
  const set = new Set<string>();
  for (const it of items) {
    const vis = (it.location_visibility || "*").trim();
    if (!vis || vis === "*" || vis === "admin") continue;
    for (const tok of vis.split(",")) {
      const r = tok.trim().toLowerCase();
      if (r && r !== "*") set.add(r);
    }
  }
  return set;
}

export function computelocations(products: Product[], role: string): string[] {
  const set = collectlocationsFrom([...products]);
  const arr = Array.from(set).sort();

  // include admin if matching role
  if (role === "admin") arr.unshift("admin");
  return arr;
}
