import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  /**
   * `next dev` blocks cross-origin requests to its dev-only assets. Opening the
   * app from another machine on the office LAN (the wall screen, a phone) would
   * otherwise render the page but never hydrate it — every dropdown and button
   * looks normal and does nothing.
   *
   * Add whatever address people actually type. This affects development only;
   * `next build && next start` has no such restriction.
   */
  allowedDevOrigins: [
    "172.16.20.85",
    "172.16.*.*",
    "192.168.*.*",
    "10.*.*.*",
    "*.local",
  ],
}

export default nextConfig
