# syntax=docker/dockerfile:1.7
# Build context: repo root (set in docker-compose.yml)

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
RUN npm ci --workspace=@breadit/frontend --workspace=@breadit/shared --include-workspace-root

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/frontend/ ./apps/frontend/
COPY packages/shared/ ./packages/shared/
RUN npm run build -w @breadit/shared && npm run build -w @breadit/frontend

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl

COPY --from=builder /app/apps/frontend/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/frontend/.next ./.next
COPY --from=builder /app/apps/frontend/public ./public
COPY --from=builder /app/apps/frontend/next.config.ts ./next.config.ts

EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]
