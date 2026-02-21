export default {
  async fetch(request, env, ctx) {
    return new Response("warband worker alive, v2 test deploy", {
      headers: { "content-type": "text/plain" }
    });
  }
};
