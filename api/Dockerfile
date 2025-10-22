FROM node:20-alpine
WORKDIR /srv
COPY api/package.json api/package-lock.json* ./
RUN npm ci
COPY api/. .
EXPOSE 3001
CMD ["node","src/index.js"]
