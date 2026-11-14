// Edge entry for the site. Serves the static app from ./public, and sends every old or
// alternate hostname (doppio.team, 2beans1cup.com, www.*) to https://doppiodrifters.com with a permanent redirect.
// Browsers keep the #/route fragment across redirects, so old links land on the same page.
const HOME = "doppiodrifters.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname;
    const isPreview = host.endsWith(".workers.dev") || host === "localhost" || host === "127.0.0.1";
    if (host !== HOME && !isPreview) {
      url.hostname = HOME;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
