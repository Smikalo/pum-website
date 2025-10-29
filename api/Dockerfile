# api/Dockerfile
FROM node:20-alpine
WORKDIR /srv
RUN apk add --no-cache openssl

# 1) Copy lockfiles and prisma EARLY so postinstall can find schema
COPY package*.json ./
COPY prisma ./prisma

# 2) Install deps (this may run @prisma/client postinstall -> prisma generate)
RUN if [ -f package-lock.json ]; then npm ci; else npm install --package-lock-only && npm ci; fi

# 3) Copy the rest
COPY src ./src

ENV PORT=3001
EXPOSE 3001
CMD npx prisma migrate deploy && node src/index.js
