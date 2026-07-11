FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && { \
        while true; do echo "npm ci still running..."; sleep 20; done & heartbeat="$!"; \
        npm ci --no-audit --no-fund; npm_status="$?"; \
        kill "$heartbeat"; wait "$heartbeat" 2>/dev/null || true; \
        test "$npm_status" -eq 0; \
    } \
    && apk del .build-deps

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

COPY scripts ./scripts
COPY migrations ./migrations
COPY seeds ./seeds

EXPOSE 3000

CMD ["node", "dist/main.js"]
