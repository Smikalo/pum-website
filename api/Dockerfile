# syntax=docker/dockerfile:1.6

FROM node:20-alpine AS deps
WORKDIR /srv
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci --ignore-scripts

FROM node:20-alpine AS dev
WORKDIR /srv
ENV NODE_ENV=development
RUN apk add --no-cache openssl
COPY --from=deps /srv/node_modules ./node_modules
COPY . .
# generate Prisma client only if a schema exists
RUN if [ -f prisma/schema.prisma ]; then npx prisma generate --schema=prisma/schema.prisma; else echo "no prisma schema, skip generate"; fi
EXPOSE 3001
CMD ["npm","run","dev"]
