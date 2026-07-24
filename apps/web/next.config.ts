import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import path from "node:path";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' http://localhost:3001 http://127.0.0.1:3001 https:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'"
].join("; ");

const nextConfig: NextConfig = {
  transpilePackages: ["@agu/ui", "@agu/config", "@agu/contracts"],
  poweredByHeader: false,
  // Cloud Run runs the app from apps/web/.next/standalone/apps/web/server.js.
  // Standalone output packages a minimal server + traced node_modules, which
  // keeps the production container image small and dependency-free of pnpm.
  output: "standalone",
  // The workspace root is two levels up from apps/web (monorepo root). Setting
  // this explicitly avoids Next.js guessing the wrong root when tracing files
  // across the pnpm workspace (packages/config, packages/contracts, packages/ui).
  outputFileTracingRoot: path.join(currentDir, "../.."),

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: cspHeader },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "0" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains"
                }
              ]
            : [])
        ]
      }
    ];
  }
};

export default nextConfig;
