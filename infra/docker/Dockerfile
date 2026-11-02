FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --maxsockets=4
COPY . .
RUN npm run build:node

FROM node:24-bookworm-slim
ENV NODE_ENV=production BIGFATFISH_DATA_DIR=/home/node/.local/share/bigfatfish
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --maxsockets=4 && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY scripts/smoke.mjs ./scripts/smoke.mjs
USER node
CMD ["node", "dist/runtime/src/main.js"]
