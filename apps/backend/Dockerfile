# syntax=docker/dockerfile:1.7@sha256:a57df69d0ea827fb7266491f2813635de6f17269be881f696fbfdf2d83dda33e
# Build context: repo root (set in docker-compose.yml)

FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/prisma ./apps/backend/prisma
RUN npm ci --workspace=@breadit/backend --include-workspace-root

FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/backend/ ./apps/backend/
RUN cd apps/backend && npx prisma generate && npm run build

FROM node:22-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl

# Copy root node_modules (most packages, prisma CLI, @prisma/client)
COPY --from=deps /app/node_modules ./node_modules
# Copy workspace-specific node_modules (jose and a few others land here per lockfile)
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
# Copy the generated Prisma client (produced by `prisma generate` in builder)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Run from backend workspace dir so Node resolution walks up through
# apps/backend/node_modules → /app/node_modules, finding jose and all deps
WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
