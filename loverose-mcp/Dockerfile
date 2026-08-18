# Serveur MCP LoveRose — image de production
# Déployable sur Railway, Render, Fly.io, Google Cloud Run, tout VPS Docker.
#
#   docker build -t loverose-mcp .
#   docker run -p 8787:8787 --env-file .env -e MCP_TRANSPORT=http loverose-mcp
#
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# Render/Railway/Cloud Run injectent PORT ; MCP_HTTP_PORT reste la variable du serveur
ENV MCP_TRANSPORT=http MCP_HTTP_PORT=8787
EXPOSE 8787
USER node
CMD ["node", "dist/index.js"]
