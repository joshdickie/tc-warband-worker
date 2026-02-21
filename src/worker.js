export default {
  async fetch(request, env, ctx) {
    return new Response("hello emma world can i haz cheezburger", {
      headers: { "content-type": "text/plain" }
    });
  }
};
