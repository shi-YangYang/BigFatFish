FROM node:24.20.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --maxsockets=4
COPY . .
RUN npm run build:node && npm run build:web

FROM node:24.20.0-bookworm-slim
ENV NODE_ENV=production BIGFATFISH_DATA_DIR=/home/node/.local/share/bigfatfish
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --maxsockets=4 && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY scripts/smoke.mjs ./scripts/smoke.mjs
RUN mkdir -p /home/node/.local/share/bigfatfish && chown -R node:node /home/node/.local
VOLUME /home/node/.local/share/bigfatfish
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s CMD node dist/cli/src/main.js status --json || exit 1
USER node
CMD ["node", "dist/runtime/src/main.js"]
