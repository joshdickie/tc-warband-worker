export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const match = url.pathname.match(/^\/api\/warband\/(\d+)$/);
    if (match) {
      const id = match[1];

      const synodUrl = `https://synod.trench-companion.com/wp-json/synod/v1/warband/${id}`;

      const upstream = await fetch(synodUrl, {
        headers: {
          "user-agent": "tc-warband-worker/0.1",
          "accept": "application/json"
        }
      });

      if (!upstream.ok) {
        return json({ error: "upstream_failed", status: upstream.status }, 502);
      }

      const data = await upstream.json();

      return json({
        source: "synod",
        id,
        data
      });
    }

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    return json({ error: "not_found" }, 404);
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*"
    }
  });
}
