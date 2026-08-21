export const handler = async (req) => {
  const api_key = (req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();

  try {
    const body = JSON.parse(req.body || "{}");

    // attach secret to body
    const upstreamPayload = JSON.stringify({
      ...body,
      key: process.env.CASHTRACKLIB_SHARED_SECRET,
      api_key,
      action: "log_event",
    });

    const upstream = await fetch(process.env.APP_SCRIPT_CONFIG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: upstreamPayload,
    });

    const text = await upstream.text(); // Apps Script returns text/json

    return {
      statusCode: JSON.parse(text).status || upstream.status,
      headers: {
        "Content-Type":
          upstream.headers.get("Content-Type") || "application/json",
        "Access-Control-Allow-Origin": "*", // you can restrict to your domain
      },
      body: text,
    };
  } catch (err) {
    console.error("append error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};
