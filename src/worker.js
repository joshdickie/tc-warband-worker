import { parseWarband } from "./warbandParser.js";

const API_VERSION = 1;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const rid = reqId()

    const m = url.pathname.match(/^\/api\/warband\/(\d+)$/);
    if (!m) {
      return json(errorEnvelope("not_found", "Path does not exist.", rid), 404, {
        "x-request-id": rid,
        "x-tc-cache": "MISS",
      });
    }

    const id = m[1];
    const ip = getClientIp(request);
    const refresh = url.searchParams.get("refresh") === "1";
    const raw = url.searchParams.get("raw") === "1";

    // tighter rate limit for refreshes
    const rateLimitRule = refresh
      ? { limit: 5, windowSec: 60 }
      : { limit: 30, windowSec: 60 };
    
    const rl = await checkRateLimit(env, `ip:${ip}:warband:${refresh ? "refresh" : "normal"}`, rateLimitRule);
    if (!rl.allowed) return tooManyRequests(rl, rid);

    const cache = caches.default;

    // Have to remove refresh flag so cache doesn't vary, and set version so it does
    const cacheKeyUrl = new URL(url.toString());
    cacheKeyUrl.searchParams.delete("refresh");
    cacheKeyUrl.searchParams.set("v", String(API_VERSION));
    const cacheKey = new Request(cacheKeyUrl.toString(), { method: "GET" });

    if (!refresh) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        console.log(JSON.stringify({ rid, event: "cache_hit", id }));
        // revalidate in background and serve stale
        ctx.waitUntil(revalidateAndUpdate(cacheKey, id, raw, rid));
        return withHeaders(cached, {
          "x-request-id": rid,
          "x-tc-cache": "HIT",
        });
      }
    }
    console.log(JSON.stringify({ rid, event: refresh ? "cache_refresh" : "cache_miss", id, raw }));

    const synodResp = await fetchFromSynodAsJson(id, rid);
    if (!synodResp.ok) {
      return json(errorEnvelope(synodResp.error, synodResp.message, rid, synodResp.extra), synodResp.status, {
        "x-request-id": rid,
        "x-tc-cache": "MISS",
      });
    }

    let resp;
    if (raw) {
      resp = json(
        {
          ok: true,
          source: "synod",
          id,
          fetchedAt: synodResp.fetchedAt,
          data: synodResp.data,
        },
        200,
        {
          "x-request-id": rid,
          "x-tc-cache": refresh ? "REFRESH" : "MISS",
        }
      );
    } else {
      try {
        const parsed = parseWarband(synodResp.data);
        resp = json(
          {
            ok: true,
            id,
            warband: parsed,
          },
          200,
          {
            "x-request-id": rid,
            "x-tc-cache": refresh ? "REFRESH" : "MISS",
          }
        );
      } catch (e) {
        console.log(JSON.stringify({ rid, event: "parse_error", id, err: String(e), stack: e?.stack }));
        resp = json(errorEnvelope("parse_error", "There was an error processing your request.", rid), 500, {
          "x-request-id": rid,
          "x-tc-cache": "MISS",
        });
      }
    }

    ctx.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
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
    body: JSON.stringify({ key, limit, windowSec }),
  });

  return resp.json();
}

function tooManyRequests({ resetIn }, rid) {
  return json(
    errorEnvelope("rate_limited", "Rate limited. Please retry after retryAfterSec seconds.", rid, {
      retryAfterSec: resetIn
    }),
    429,
    {
      "x-request-id": rid,
      "retry-after": String(Math.max(1, resetIn)),
      "x-tc-cache": "MISS",
    }
  );
}

async function revalidateAndUpdate(cacheKey, id, raw, rid) {
  const cache = caches.default;

  const synodResp = await fetchFromSynodAsJson(id, rid);
  if (!synodResp.ok) {
    console.log(JSON.stringify({ rid, event: "revalidate_failed", id, raw, status: synod.status, error: synod.error }));
    return;
  }

  let resp;
  if (raw) {
    resp = json(
      {
        ok: true,
          source: "synod",
          id,
          fetchedAt: synodResp.fetchedAt,
          data: synodResp.data,
      },
      200,
      {
        "x-request-id": rid,
        "x-tc-cache": "REVALIDATE",
      }
    );
  } else {
    try {
      const parsed = parseWarband(synodResp.data);
      resp = json(
        {
          ok: true,
          id,
          warband: parsed,
        },
        200,
        {
          "x-request-id": rid,
          "x-tc-cache": "REVALIDATE",
        }
      );
    } catch (e) {
      console.log(JSON.stringify({ rid, event: "revalidate_parse_error", id, err: String(e), stack: e?.stack }));
      return;
    }
  }

  await cache.put(cacheKey, resp.clone());
  console.log(JSON.stringify({ rid, event: "revalidate_ok", id, raw }));
}

async function fetchFromSynodAsJson(id, rid) {
  const synodUrl = `https://synod.trench-companion.com/wp-json/synod/v1/warband/${id}`;
  const abortController = new AbortController();
  const t = setTimeout(() => abortController.abort(), 8000);

  let upstream;
  try {
    upstream = await fetch(synodUrl, {
      signal: abortController.signal,
      headers: {
        "user-agent": "tc-warband-worker/0.1",
        accept: "application/json",
      },
    });
  } catch (e) {
    console.log(JSON.stringify({ rid, event: "upstream_error", id, err: String(e) }));
    return {
      ok: false,
      status: 502,
      error: "upstream_failed",
      message: "Call to synod.trench-companion.com failed.",
      extra: { detail: String(e) },
    };
  }finally {
    clearTimeout(t);
  }

  if (!upstream.ok) {
    let body;
    try {
      body = await upstream.json();
    } catch {
      body =null;
    }

    // synod returns 400 "invalid_post" when warband doesn't exist
    if (upstream.status === 400 && body?.code === "invalid_post") {
      console.log(JSON.stringify({
        rid,
        event: "warband_not_found",
        id,
      }));

      return {
        ok: false,
        status: 404,
        error: "not_found",
        message: "Warband does not exist.",
        extra: {},
      };
    }
    // other upstream failure
    console.log(JSON.stringify({
      rid,
      event: "upstream_http_error",
      id,
      status: upstream.status,
      body,
    }));
    return {
      ok: false,
      status: 502,
      error: "upstream_failed",
      message: "Call to synod.trench-companion.com failed.",
      extra: {
        upstream_status: upstream.status,
        upstream_code: body?.code,
      },
    };
  }

  const data = await upstream.json();
  return {
    ok: true,
    fetchedAt: new Date().toISOString(),
    data
  };
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

function withHeaders(response, newHeaders = {}) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(newHeaders)) {
    if (v !== undefined && v !== null) headers.set(k, String(v));
  }

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

export { RateLimiter } from "./rateLimiter.js"
