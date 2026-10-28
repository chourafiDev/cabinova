import type { NextConfig } from "next";

// Browser hardening for every page.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" }, // no file-type guessing
  { key: "X-Frame-Options", value: "SAMEORIGIN" }, // can't be embedded in another site (clickjacking)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const clinicApiUrl = process.env.CLINIC_API_URL ?? "http://localhost:4100";

// The clinic app: what a cabinet's team uses at <subdomain>.cabinova.ma
// (<subdomain>.localhost:3002 in development).
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Browser → /api/* → clinic-api, same origin: the session cookie stays on
  // the cabinet's subdomain, and the API reads the cabinet from the host.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${clinicApiUrl}/:path*` }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
