import type { NextConfig } from "next";

// Browser hardening for every page.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" }, // no file-type guessing
  { key: "X-Frame-Options", value: "SAMEORIGIN" }, // can't be embedded in another site (clickjacking)
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const apiUrl = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Browser → /api/* → NestJS. The proxy sends X-Forwarded-Host, from which
  // the API resolves the tenant (clinique-x.cabinova.ma → "clinique-x").
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
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
