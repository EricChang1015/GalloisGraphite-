import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to be accessed by LAN IP (e.g. for mobile or cross-device testing).
  // This enables Next.js internal dev resources (HMR, etc.) from those origins.
  // Add / remove IPs as needed; only takes effect in `next dev`.
  allowedDevOrigins: [
    "10.1.2.106",
    // add more LAN IPs here if needed, e.g. "192.168.1.*"
  ],
};

export default nextConfig;
