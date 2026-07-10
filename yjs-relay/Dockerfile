FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --package-lock-only 2>/dev/null || true
# Install production dependencies with proper lockfile
RUN npm ci || npm install --production
COPY server.js ./
ENV PORT=1234
CMD ["node", "server.js"]
