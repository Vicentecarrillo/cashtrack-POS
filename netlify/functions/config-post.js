export const handler = async (event) => {
  try {
    const api_key = (event.headers.authorization || "")
      .replace(/^Bearer\s+/i, "")
      .trim();

    if (!api_key) {
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 401,
      });
    }

    const body = JSON.parse(event.body || "{}");
    const upstreamPayload = JSON.stringify({
      ...body,
      api_key,
      key: process.env.CASHTRACKLIB_SHARED_SECRET,
    });
    const res = await fetch(process.env.APP_SCRIPT_CONFIG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${api_key}`,
      },
      body: upstreamPayload,
    });

    const data = await res.json().catch(() => ({}));

    return {
      statusCode: data.status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error("config-post error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      statusCode: 500,
    });
  }
};
