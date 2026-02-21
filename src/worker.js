export default {
  async fetch(request, env, ctx) {
    return new Response("warband worker alive", {
      headers: { "content-type": "text/plain" }
    });
  }
};
