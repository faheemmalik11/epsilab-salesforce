# syntax=docker/dockerfile:1
FROM --platform=linux/amd64 node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json tsconfig.server.json tsconfig.web.json vite.config.ts ./
COPY src ./src
COPY scripts ./scripts
COPY seed ./seed
RUN pnpm build && DATA_DIR=/app/data SEED_DIR=/app/seed pnpm build:db
RUN pnpm prune --prod --ignore-scripts

FROM --platform=linux/amd64 node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    GUI_PORT=3000 \
    API_PORT=8080 \
    DATA_DIR=/app/data \
    SEED_DIR=/app/seed \
    WEB_DIR=/app/dist/web \
    SEED_PROFILE=default \
    CLOCK=2028-11-11T09:00:00Z
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/seed ./seed
COPY --from=build --chown=node:node /app/data ./data
USER node
EXPOSE 3000 8080
CMD ["node", "dist/server/src/server/main.js"]
