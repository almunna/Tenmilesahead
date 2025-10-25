# syntax=docker/dockerfile:1

############################
# 1) Dependencies layer
############################
FROM node:20-alpine AS deps
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat

# Copy minimal files to install dependencies with cache
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Install using the detected lockfile
RUN \
  if [ -f package-lock.json ]; then npm ci --include=dev; \
  elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm install --frozen-lockfile; \
  else npm install; fi


############################
# 2) Build layer
############################
FROM node:20-alpine AS builder
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLE=1

# Bring node_modules and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ----- Firebase public config as BUILD ARGS (Render will pass them) -----
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID

# Expose them to Next at build time
ENV NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
ENV NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID}
ENV NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}
ENV NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}
ENV NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID}
ENV NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=${NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID}

# Build (Next should have output: 'standalone')
RUN npm run build


############################
# 3) Runtime layer
############################
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLE=1

# Render sets $PORT dynamically; Next's server.js will respect it.
# Do NOT hardcode PORT here.

# Non-root user
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

# Copy the standalone server and static assets
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

# Healthcheck (optional; Render also has its own)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch(`http://127.0.0.1:${process.env.PORT||3000}`).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

USER nextjs
CMD ["node", "server.js"]
