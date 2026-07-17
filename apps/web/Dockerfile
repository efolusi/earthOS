# EarthOS flagship app: multi-stage build on the pnpm monorepo.
FROM node:22-alpine AS base
RUN corepack enable pnpm
WORKDIR /repo

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo build --filter=@earthos/web

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -S earthos && adduser -S earthos -G earthos
COPY --from=build --chown=earthos:earthos /repo/apps/web/.next/standalone ./
COPY --from=build --chown=earthos:earthos /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=earthos:earthos /repo/apps/web/public ./apps/web/public
USER earthos
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
