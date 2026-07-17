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

2k textures are committed and served from `/public/textures` (NASA imagery, public domain). For higher fidelity, drop 4k/8k equirect replacements into the same paths or point the `textures` prop of `<Earth/>`/`EarthCanvas` at a CDN. Long-cache them (`Cache-Control: immutable`): filenames are stable.

## SDK consumers

`npm install earthos three @react-three/fiber @react-three/drei react react-dom framer-motion`. The SDK ships compiled ESM with `"use client"` boundaries: it works in Next.js App Router (client components), Vite, and any modern ESM bundler without transpilation config. Both are built in CI (`examples/nextjs-minimal`, `examples/vite-spa`) as the compatibility gate.

## Health and headers

The app is stateless (state lives in the browser). For orchestration, use the root page as liveness. If you enable `SharedArrayBuffer` optimizations later, remember COOP/COEP headers; the baseline needs none.
