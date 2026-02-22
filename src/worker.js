export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const m = url.pathname.match(/^\/api\/warband\/(\d+)$/);
    if (!m) return json({ error: "not_found" }, 404);

    const id = m[1];
    const refresh = url.searchParams.get("refresh") === "1";

    const cache = caches.default;

    // Have to remove refresh flag so cache doesn't vary
    const cacheKeyUrl = new URL(url.toString());
    cacheKeyUrl.searchParams.delete("refresh");
    const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

    if (!refresh) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        // revalidate in background and serve stale
        ctx.waitUntil(revalidateAndUpdate(cacheKey, id));
        return withHeader(cached, "x-tc-cache", "HIT");
      }
    }

    const freshResp = await fetchFromSynodAsResponse(id);
    if (freshResp.status !== 200) return freshResp;

    ctx.waitUntil(cache.put(cacheKey, freshResp.clone()));
    return withHeader(freshResp, "x-tc-cache", refresh ? "REFRESH" : "MISS");
  }
};

async function revalidateAndUpdate(cacheKey, id) {
  const cache = caches.default;
  const resp = await fetchFromSynodAsResponse(id);
  if (resp.status === 200) {
    await cache.put(cacheKey, resp.clone());
  }
}

async function fetchFromSynodAsResponse(id) {
  const synodUrl = `https://synod.trench-companion.com/wp-json/synod/v1/warband/${id}`;

  const upstream = await fetch(synodUrl, {
    headers: {
      "user-agent": "tc-warband-worker/0.1",
      accept: "application/json",
    },
  });

  if (!upstream.ok) {
    return json(
      { error: "upstream_failed", upstream_status: upstream.status },
      502
    );
  }

  const data = await upstream.json();

  return json(
    {
      source: "synod",
      id,
      fetchedAt: new Date().toISOString(),
      data,
    },
    200
  );
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      ...extraHeaders,
    },
  });
}

function withHeader(response, key, value) {
  const headers = new Headers(response.headers);
  headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
