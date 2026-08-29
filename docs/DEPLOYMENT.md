# Deployment Guide

## The flagship app (apps/web)

### Cloudflare Workers

EarthOS deploys only to Cloudflare Workers. It has no VPS, PM2, or application-
container deployment. `@opennextjs/cloudflare` compiles the Next build into a
Worker bundle under `apps/web/.open-next` (`worker.js` plus an `assets`
directory), and `wrangler` ships it.

```bash
pnpm --filter @earthos/web build:worker   # opennextjs-cloudflare build
pnpm --filter @earthos/web preview:cf     # build, then wrangler dev
pnpm --filter @earthos/web deploy:cf      # build, then wrangler deploy
```

`apps/web/open-next.config.ts` holds the adapter config. It is `defineCloudflareConfig()` with defaults: the proxy routes do their own caching and ISR is not used, so no incremental cache is wired up. Add an R2 or KV incremental cache there if you want data-cache persistence.

Two wrangler configs exist on purpose, and they must be kept in sync:

- `/wrangler.jsonc` at the repo root, so a bare `wrangler deploy` works when the deploy command runs from the root (a Cloudflare build that never does `cd apps/web`). Its paths are repo-relative: `main` is `apps/web/.open-next/worker.js`, assets are `apps/web/.open-next/assets`.
- `apps/web/wrangler.jsonc` mirrors it with app-relative paths (`.open-next/worker.js`, `.open-next/assets`), which is what the `deploy:cf` and `preview:cf` scripts pick up because they run inside `apps/web`.

Both declare `compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]`. `nodejs_compat` covers the Node built-ins the Next runtime expects; `global_fetch_strictly_public` makes the Worker's own outbound `fetch()` calls (the CelesTrak, NHC and OpenSky proxies) resolve over the public internet instead of looping back into the Worker. Both also share the Worker `name` and enable observability: if you rename one, rename the other, or you will deploy two Workers and only one of them will have your custom domain attached.

Server-side secrets go in with `wrangler secret put OPENSKY_CLIENT_ID` (and `OPENSKY_CLIENT_SECRET`), not in the config file.

## API keys and proxies

EarthOS never ships API keys client-side. The pattern:

1. Every keyed provider exposes an `endpoint` setting.
2. The deployment hosts a proxy route that injects the key server-side (see `apps/web/app/api/proxy/celestrak/route.ts` for the reference: allow-listed params, server-side caching, sane cache-control).
3. The app points the plugin's `endpoint` at its proxy.

Three proxy routes ship under `apps/web/app/api/proxy`:

- `celestrak` takes no credential (CelesTrak is keyless). It exists for deployments that want centralized upstream traffic: one fetch per group per hour serves every visitor, with a week-long stale-while-error cache for when CelesTrak 403s a noisy IP. Off by default.
- `opensky` is the only route that reads secrets. With `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` set it runs OpenSky's OAuth client-credentials flow for higher upstream limits; without them it proxies anonymously. Off by default.
- `nhc` is the only proxy enabled by default. NOAA's `CurrentStorms.json` is not reachable browser-direct, so `apps/web/components/EarthApp.tsx` patches the hurricanes plugin's `endpoint` to `/api/proxy/nhc` when none is set. No credential; shared 10-minute cache.

Satellites and aircraft are browser-direct in the flagship app, not proxied. CelesTrak and airplanes.live both serve permissive CORS and both block cloud egress IPs, so `plugins/satellites/src/provider.ts` defaults to `https://celestrak.org/NORAD/elements/gp.php` and `plugins/aircraft/src/provider.ts` defaults to `https://api.airplanes.live/v2/point`. `EarthApp.tsx` additionally clears any persisted `/api/proxy/celestrak` or `/api/proxy/opensky` endpoint left behind by older builds, so returning visitors are not pinned to a proxy the app no longer uses. OpenSky stays selectable as an aircraft data source for deployments that do want the authenticated global feed behind the proxy.

Optional server-side secrets `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET`
are read by `apps/web/app/api/proxy/opensky/route.ts` and must be configured as
Worker secrets. `OPENWEATHER_API_KEY` is currently unused: it is reserved for
a roadmap plugin.

## Textures

Both the 2k base set and the optional 8k set are committed under `/public/textures` (build hosts often cannot reach the texture CDN). They are not public domain: the base set is the three.js planet textures (NASA-derived, free to use) and the 8k set is Solar System Scope (CC BY 4.0). See [apps/web/public/textures/CREDITS.md](../apps/web/public/textures/CREDITS.md). `scripts/fetch-hd-textures.mjs` re-fetches the 8k set if you need to refresh it; the app detects it at boot and switches automatically, 16x sharper when zoomed. Long-cache all of them (`Cache-Control: immutable`): filenames are stable.

Single equirect textures bottom out around a ~5 km texel even at 8k: street-level sharpness requires the tiled-imagery roadmap item (quadtree tiles with per-tile origins), not bigger single textures.

## Sample data

`/public/samples` is committed the same way the textures are: `kdmp-merah-putih-sample.geojson` (1,900 Indonesian village centroids, the sample dataset the Custom GeoJSON layer loads through its `url` setting) plus `CREDITS.md`. Everything under `apps/web/public` is copied into `.open-next/assets` on every Cloudflare deploy and served by the `ASSETS` binding, so this dataset ships with the Worker, not just with the repo.

It is the most restrictively licensed asset here. The geometry comes from Badan Informasi Geospasial, which declares no open-data licence on the service it was taken from. Read [apps/web/public/samples/CREDITS.md](../apps/web/public/samples/CREDITS.md) and confirm reuse terms with BIG before redistributing it beyond this demo.

## SDK consumers

`npm install earthos three @react-three/fiber @react-three/drei react react-dom framer-motion`. The SDK ships compiled ESM with `"use client"` boundaries: it works in Next.js App Router (client components), Vite, and any modern ESM bundler without transpilation config. Both are built in CI (`examples/nextjs-minimal`, `examples/vite-spa`) as the compatibility gate.

If you use the optional `@earthos/ui` panels, their styles are Tailwind utility classes: add `@source "../node_modules/@earthos/ui/src";` to your Tailwind CSS entry (the package ships its `src` for exactly this) and provide the design tokens they reference (see the package README). The 3D layers need none of this.

## Health and headers

The app is stateless (state lives in the browser). For orchestration, use the root page as liveness. If you enable `SharedArrayBuffer` optimizations later, remember COOP/COEP headers; the baseline needs none.
