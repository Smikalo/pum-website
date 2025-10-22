FROM node:20-alpine
WORKDIR /srv
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["node","src/index.js"]
