/**
 * Absolute URL on a tenant's subdomain, e.g. ("http://localhost:3000",
 * "localhost", "demo", "/invite/abc") → "http://demo.localhost:3000/invite/abc".
 * Used for links sent by email, where there is no request to read the host from.
 */
export function tenantUrl(
  webOrigin: string,
  rootDomain: string,
  slug: string,
  path: string,
) {
  const url = new URL(webOrigin);
  url.host = `${slug}.${rootDomain}${url.port ? `:${url.port}` : ''}`;
  url.pathname = path;
  return url.toString();
}
