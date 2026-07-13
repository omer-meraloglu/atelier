import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A stray lockfile in $HOME makes Turbopack infer the wrong workspace
  // root, which breaks client-chunk resolution (pages render but never
  // hydrate). Pin it explicitly.
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      // Supabase Storage signed URLs (hosted)
      { protocol: "https", hostname: "**.supabase.co" },
      // Local supabase stack in development
      { protocol: "http", hostname: "127.0.0.1", port: "54321" },
      { protocol: "http", hostname: "localhost", port: "54321" },
    ],
    // Required for optimizing images served by the local Supabase stack.
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
  },
};

export default nextConfig;
