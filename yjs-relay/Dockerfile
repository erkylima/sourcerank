FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY server.js ./
ENV PORT=1234
CMD ["node", "server.js"]
