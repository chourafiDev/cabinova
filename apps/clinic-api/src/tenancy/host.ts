/**
 * "atlas.cabinova.ma" → "atlas"; also "atlas.localhost" when localhost is
 * allowed (development). Anything else — the bare domain, deeper
 * subdomains, other hosts — is no cabinet.
 */
export function subdomainOf(host: string, baseDomains: string[]) {
  const hostname = host.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
  for (const base of baseDomains) {
    const suffix = `.${base.toLowerCase()}`;
    if (!hostname.endsWith(suffix)) continue;
    const label = hostname.slice(0, -suffix.length);
    return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(label) ? label : null;
  }
  return null;
}
