FROM node:20-alpine
WORKDIR /srv
COPY package*.json ./
RUN [ -f package-lock.json ] && npm ci || (npm install --package-lock-only && npm ci)
COPY . .
EXPOSE 3001
CMD ["node","src/index.js"]
