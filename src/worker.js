export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const rid = reqId()
    const API_VERSION = 1;

    const m = url.pathname.match(/^\/api\/warband\/(\d+)$/);
    if (!m) return json(errorEnvelope("not_found", "Path does not exist.", rid), 404);

    const id = m[1];
    const ip = getClientIp(request);
    const refresh = url.searchParams.get("refresh") === "1";

    // tighter rate limit for refreshes
    const rateLimitRule = refresh
      ? { limit: 5, windowSec: 60 }
      : { limit: 30, windowSec: 60 };
    
    const rl = await checkRateLimit(env, `ip:${ip}:warband:${refresh ? "refresh" : "normal"}`, rateLimitRule);
    if (!rl.allowed) return tooManyRequests(rl, rid);

    const cache = caches.default;

    // Have to remove refresh flag so cache doesn't vary
    const cacheKeyUrl = new URL(url.toString());
    cacheKeyUrl.searchParams.delete("refresh");
    cacheKeyUrl.searchParams.set("v", String(API_VERSION));
    const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

    if (!refresh) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        console.log(JSON.stringify({ rid, event: "cache_hit", id }));
        // revalidate in background and serve stale
        ctx.waitUntil(revalidateAndUpdate(cacheKey, id, rid));
        return withHeader(cached, "x-tc-cache", "HIT");
      }
    }
    console.log(JSON.stringify({ rid, event: refresh ? "cache_refresh" : "cache_miss", id }));

    const freshResp = await fetchFromSynodAsResponse(id, rid);
    if (freshResp.status !== 200) return freshResp;

    ctx.waitUntil(cache.put(cacheKey, freshResp.clone()));
    return withHeader(freshResp, "x-tc-cache", refresh ? "REFRESH" : "MISS");
  }
};

function reqId() {
  return crypto.randomUUID();
}

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

function tooManyRequests({ resetIn }, rid) {
  return new Response(JSON.stringify(errorEnvelope(
    "rate_limited",
    "rate limited, retry after retryAfterSec seconds.",
    rid,
    { retryAfterSec: resetIn }
  )), {
    status: 429,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "retry-after": String(Math.max(1, resetIn)),
      "access-control-allow-origin": "*"
    }
  });
}

async function revalidateAndUpdate(cacheKey, id, rid) {
  const cache = caches.default;
  const resp = await fetchFromSynodAsResponse(id, rid);
  if (resp.status === 200) {
    await cache.put(cacheKey, resp.clone());
  }
}

async function fetchFromSynodAsResponse(id, rid) {
  const synodUrl = `https://synod.trench-companion.com/wp-json/synod/v1/warband/${id}`;

  const upstream = await fetch(synodUrl, {
    headers: {
      "user-agent": "tc-warband-worker/0.1",
      accept: "application/json",
    },
  });

  if (!upstream.ok) {
    return json(errorEnvelope(
      "upstream_failed",
      "Call to synod.trench-companion.com failed.",
      rid,
      { upstream_status: upstream.status }
    ),
    502);
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

function errorEnvelope(error, message, rid, extraFields = {}) {
  return {
    error,
    message,
    rid,
    ...extraFields,
  }
}

export { RateLimiter } from "./rateLimiter"
