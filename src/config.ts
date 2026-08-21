export const APP_VERSION = "0.1.0";
export const ENDPOINT_APPEND_URL = "/.netlify/functions/append";
export const ENDPOINT_PRODUCTS_URL = "/.netlify/functions/products-get";
export const ENDPOINT_CONFIG_URL = "/.netlify/functions/config-post";

export const API_ACTIONS = {
  config: {
    createNewSheet: "createNewSheet",
    createKey: "createKey",
    revokeKey: "revokeKey",
    listKeys: "listKeys",
    registerDevice: "registerDevice",
  },
};

export async function ensureDurableStorage() {
  if ("storage" in navigator && "persist" in navigator.storage) {
    try {
      const persisted = await navigator.storage.persisted();
      if (!persisted) await navigator.storage.persist();
    } catch {}
  }
}

export function deviceId() {
  let id = localStorage.getItem("device_id");
  if (!id) {
    id = crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    localStorage.setItem("device_id", id);
  }
  return id;
}
