# api/Dockerfile
FROM node:20-alpine AS deps
WORKDIR /srv

# System deps for native modules (argon2, etc.)
RUN apk add --no-cache python3 make g++ libc6-compat openssl

# Only copy manifests and Prisma schema for a deterministic install layer
COPY package*.json ./
COPY prisma ./prisma

# IMPORTANT: we rely on a committed, up-to-date lockfile
# If lockfile is out of sync, npm ci will fail (as intended).
RUN npm ci

# --- Runtime image ---
FROM node:20-alpine AS app
WORKDIR /srv
ENV NODE_ENV=production

# You may keep libc6-compat in runtime because native prebuilds may need it
RUN apk add --no-cache libc6-compat openssl

# Copy node_modules from deps stage
COPY --from=deps /srv/node_modules ./node_modules

# Copy the rest of the source
COPY . .

# Expose & start
EXPOSE 3001
CMD ["node", "src/index.js"]
