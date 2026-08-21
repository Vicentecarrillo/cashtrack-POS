import { getAllEvents } from "./db";

export async function exportCSV() {
  const events = await getAllEvents();
  const headers = [
    "local_event_id",
    "kind",
    "date",
    "location",
    "amount",
    "note",
  ];
  const rows = events.map((e: any) => [
    e.local_event_id,
    e.kind,
    e.ts,
    e.location,
    e.amount,
    e.note || "",
  ]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => r.map(escapeCSV).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `events-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeCSV(v: any) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
