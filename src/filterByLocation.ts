export function filterByLocation<T extends { location_visibility?: string }>(
  items: T[],
  location: string
): T[] {
  const r = location.trim().toLowerCase();
  if (r === "admin") return items;
  return items.filter((it) => {
    const vis = (it.location_visibility || "*").trim();
    if (vis === "*") return true;
    const tokens = vis.split(",").map((s) => s.trim().toLowerCase());
    return tokens.includes(r);
  });
}
