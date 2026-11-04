// Cloudflare Worker in front of the static site in /dist.
// Its only job: send www.spendmath.com and plain http:// to https://spendmath.com
// (a _redirects file can't redirect by host name or protocol). Every other
// request is served from the static assets, including the 404 page.
const HOST = 'spendmath.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ours = url.hostname === HOST || url.hostname === `www.${HOST}`;
    if (ours && (url.hostname !== HOST || url.protocol !== 'https:')) {
      url.hostname = HOST;
      url.protocol = 'https:';
      url.port = '';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  }
};
