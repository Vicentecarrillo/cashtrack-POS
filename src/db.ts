import { openDB } from "idb";

export type Product = {
  product_id: string;
  name: string;
  price: number;
  unit_cost?: number;
  category?: string;
  vendor?: string;
  product_type?: string;
  active: boolean;
  location_visibility?: string; // '*' or comma list
  updated_at?: string;
};

const DB_NAME = "cashtrack_db";
const dbp = openDB(DB_NAME, 5, {
  upgrade(db, oldVersion) {
    // events store already exists in your app
    if (!db.objectStoreNames.contains("events")) {
      const s = db.createObjectStore("events", { keyPath: "local_event_id" });
      s.createIndex("synced", "synced");
    }
    // meta KV store for cursors and misc
    if (!db.objectStoreNames.contains("meta")) {
      db.createObjectStore("meta");
    }
    // products store
    if (!db.objectStoreNames.contains("products")) {
      const p = db.createObjectStore("products", { keyPath: "product_id" });
      p.createIndex("updated_at", "updated_at");
      p.createIndex("active", "active");
    }
  },
});

// --- META helpers ---
export async function getMeta<T = any>(key: string): Promise<T | undefined> {
  const db = await dbp;
  return db.transaction("meta").objectStore("meta").get(key);
}
export async function setMeta<T>(key: string, value: T) {
  const db = await dbp;
  await db.transaction("meta", "readwrite").objectStore("meta").put(value, key);
}

// --- PRODUCTS ---
export async function mergeProducts(items: Product[]) {
  const db = await dbp;
  const tx = db.transaction("products", "readwrite");
  const store = tx.objectStore("products");
  for (const it of items) await store.put(it);
  await tx.done;
}

export async function replaceProducts(items: Product[]) {
  const db = await dbp;
  const tx = db.transaction("products", "readwrite");
  const s = tx.objectStore("products");
  await s.clear();
  for (const it of items) await s.put(it);
  await tx.done;
}

export async function getCachedProducts(): Promise<Product[]> {
  const db = await dbp;
  return db.getAll("products");
}

export async function putEvent(evt: any) {
  const db = await dbp;
  await db.put("events", evt);
}
export async function getUnsynced(limit = 20) {
  const db = await dbp;
  const all = await db.getAllFromIndex("events", "synced", IDBKeyRange.only(0));
  return all.slice(0, limit);
}
export async function markSynced(id: string) {
  const db = await dbp;
  return updateEvent(id, { synced: 1 });
}
export async function updateEvent(id: string, patch: any) {
  const db = await dbp;
  const v = await db.get("events", id);
  await db.put("events", { ...v, ...patch });
}
export async function countUnsynced() {
  const db = await dbp;
  return await db.countFromIndex("events", "synced", IDBKeyRange.only(0));
}
export async function getAllEvents() {
  const db = await dbp;
  return await db.getAll("events");
}
