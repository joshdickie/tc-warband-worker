export class RateLimiter {
  constructor(state, env) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request) {
    const { key, limit, windowSec } = await request.json();

    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % windowSec);
    const bucketKey = `${key}:${windowStart}`;

    let count = (await this.storage.get(bucketKey)) || 0;
    count += 1;

    // store with TTL slightly longer than window
    await this.storage.put(bucketKey, count, { expiration: windowStart + windowSec + 5 });

    const remaining = Math.max(0, limit - count);
    const resetIn = windowStart + windowSec - now;

    const allowed = count <= limit;

    return new Response(
      JSON.stringify({ allowed, count, remaining, resetIn }),
      {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" }
      }
    );
  }
}