export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const m = url.pathname.match(/^\/api\/warband\/(\d+)$/);
    if (!m) return json({ error: "not_found" }, 404);

    const id = m[1];
    const ip = getClientIp(request);
    const refresh = url.searchParams.get("refresh") === "1";

    // tighter rate limit for refreshes
    const rateLimitRule = refresh
      ? { limit: 5, windowSec: 60 }
      : { limit: 30, windowSec: 60 };
    
    const rl = await checkRateLimit(env, `ip:${ip}:warband:${refresh ? "refresh" : "normal"}`, rateLimitRule);
    if (!rl.allowed) return tooManyRequests(rl);

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

function getClientIp(request) {
  return request.headers.get("cf-connecting-ip") || "0.0.0.0";
}

async function checkRateLimit(env, key, { limit, windowSec }) {
  const id = env.RL.idFromName("global-rate-limiter");
  const stub = env.RL.get(id);

  const resp = await stub.fetch("https://rl/check", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key, limit, windowSec })
  });

  return resp.json();
}

function tooManyRequests({ resetIn }) {
  return new Response(JSON.stringify({ error: "rate_limited", retryAfterSec: resetIn }), {
    status: 429,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "retry-after": String(Math.max(1, resetIn)),
      "access-control-allow-origin": "*"
    }
  });
}

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

export { RateLimiter } from "./rateLimiter"
