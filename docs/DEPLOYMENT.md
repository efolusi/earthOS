# Deployment Guide

## The flagship app (apps/web)

### Docker (recommended)

```bash
docker compose up --build
# or
docker build -f apps/web/Dockerfile -t earthos-web .
docker run -p 3000:3000 earthos-web
```

Multi-stage build: pnpm install + turbo build, then a minimal `node:22-alpine` runtime with Next standalone output, running as a non-root user.

### Node

```bash
pnpm install && pnpm turbo build --filter=@earthos/web
node apps/web/.next/standalone/apps/web/server.js
```

### Static hosts / Vercel-alikes

`apps/web` is a standard Next.js 15 App Router app. Point the platform at the monorepo root with `pnpm turbo build --filter=@earthos/web` as the build command.

## API keys and proxies

EarthOS never ships API keys client-side. The pattern:

1. Every keyed provider exposes an `endpoint` setting.
2. The deployment hosts a proxy route that injects the key server-side (see `apps/web/app/api/proxy/celestrak/route.ts` for the reference: allow-listed params, server-side caching, sane cache-control).
3. The app points the plugin's `endpoint` at its proxy.

The CelesTrak proxy is enabled by default in the flagship app even though CelesTrak needs no key: it centralizes upstream traffic (one fetch per group per hour serves every visitor) and shields users behind networks that block or fingerprint direct API calls.

Environment variables consumed by the compose file (all optional, all server-side): `OPENWEATHER_API_KEY`, `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` (reserved for the roadmap plugins).

## Textures

Both the 2k base set and the optional 8k set are committed under `/public/textures` (build hosts often cannot reach the texture CDN). They are not public domain: the base set is the three.js planet textures (NASA-derived, free to use) and the 8k set is Solar System Scope (CC BY 4.0). See [apps/web/public/textures/CREDITS.md](../apps/web/public/textures/CREDITS.md). `scripts/fetch-hd-textures.mjs` re-fetches the 8k set if you need to refresh it; the app detects it at boot and switches automatically, 16x sharper when zoomed. Long-cache all of them (`Cache-Control: immutable`): filenames are stable.

Single equirect textures bottom out around a ~5 km texel even at 8k: street-level sharpness requires the tiled-imagery roadmap item (quadtree tiles with per-tile origins), not bigger single textures.

## SDK consumers

`npm install earthos three @react-three/fiber @react-three/drei react react-dom framer-motion`. The SDK ships compiled ESM with `"use client"` boundaries: it works in Next.js App Router (client components), Vite, and any modern ESM bundler without transpilation config. Both are built in CI (`examples/nextjs-minimal`, `examples/vite-spa`) as the compatibility gate.

If you use the optional `@earthos/ui` panels, their styles are Tailwind utility classes: add `@source "../node_modules/@earthos/ui/src";` to your Tailwind CSS entry (the package ships its `src` for exactly this) and provide the design tokens they reference (see the package README). The 3D layers need none of this.

## Health and headers

The app is stateless (state lives in the browser). For orchestration, use the root page as liveness. If you enable `SharedArrayBuffer` optimizations later, remember COOP/COEP headers; the baseline needs none.
