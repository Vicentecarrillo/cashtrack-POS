export async function handler(event) {
  if (!process.env.APP_SCRIPT_CONFIG_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Missing APP_SCRIPT_CONFIG_URL" }),
    };
  }
  const apiKey = (event.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  try {
    const url = new URL(process.env.APP_SCRIPT_CONFIG_URL);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("action", "getProducts");

    // Preserve query params from client → forward to Apps Script
    // const qs = event.rawUrl.includes("?") ? event.rawUrl.split("?")[1] : "";
    // const target = `${url}?action=products${qs ? "&" + qs : ""}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const text = await res.text();

    return {
      statusCode: JSON.parse(text).status || res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: text,
    };
  } catch (err) {
    console.log("products-get error ", err);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: String(err) }),
    };
  }
}
