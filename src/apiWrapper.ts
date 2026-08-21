import { deviceId, ENDPOINT_CONFIG_URL } from "./config";

export async function callConfig(action: string, payload = {}) {
  const res = await fetch(ENDPOINT_CONFIG_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("api_key")}`,
      "X-Device-ID": deviceId(),
    },
    body: JSON.stringify({ action, ...payload }),
  });

  if (!res.ok) throw new Error("Config request failed");
  return await res.json();
}
