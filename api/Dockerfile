# api/Dockerfile

# --- deps stage ---
FROM node:20-bookworm-slim AS deps
WORKDIR /srv

# System deps for native modules (argon2, etc.)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Only copy manifests and Prisma schema
COPY package*.json ./
COPY prisma ./prisma

# Deterministic install (still runs postinstall -> prisma generate)
RUN npm ci

# --- runtime image ---
FROM node:20-bookworm-slim AS app
WORKDIR /srv
ENV NODE_ENV=production

# Install runtime deps Prisma needs (openssl for engine detection)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Copy node_modules from deps stage
COPY --from=deps /srv/node_modules ./node_modules

# Copy the rest of the source
COPY . .

EXPOSE 3001
CMD ["node", "src/index.js"]

