# multi-stage build for backend-yjs
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --production
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
# copy data dir mount target
RUN mkdir -p /app/data
EXPOSE 1234
CMD ["node", "dist/server.js"]
