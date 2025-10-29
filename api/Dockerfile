# -------- deps stage: install deps with your conditional npm ci flow --------
FROM node:20-alpine AS deps
WORKDIR /srv
COPY package*.json ./
RUN [ -f package-lock.json ] && npm ci || (npm install --package-lock-only && npm ci)

# -------- build stage: compile TypeScript to dist/ --------------------------
FROM node:20-alpine AS build
WORKDIR /srv
COPY --from=deps /srv/node_modules ./node_modules
COPY . .
# Generate Prisma client if present; don't fail the build if prisma isn't wired yet
RUN npx prisma generate || true
RUN npm run build

# -------- runner stage: minimal prod image -------------------
FROM node:20-alpine AS runner
WORKDIR /srv
ENV NODE_ENV=production \
    NODE_OPTIONS="--trace-uncaught --trace-warnings --unhandled-rejections=strict"
COPY package*.json ./
RUN [ -f package-lock.json ] && npm ci --omit=dev || (npm install --package-lock-only && npm ci --omit=dev)
COPY --from=build /srv/dist ./dist
EXPOSE 3001
CMD ["node", "dist/src/server.js"]
