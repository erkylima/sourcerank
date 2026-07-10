FROM node:20-alpine

# Install system dependencies for all languages
RUN apk add --no-cache \
    python3 \
    python3-dev \
    py3-pip \
    openjdk21-jre \
    openjdk21-jdk \
    go \
    mono \
    mono-dev \
    bash \
    curl \
    wget \
    ca-certificates \
    tzdata \
    dumb-init

# Create sandbox and temp directories
RUN mkdir -p /sandbox /tmp/executions && \
    chmod 777 /sandbox /tmp/executions

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Generate package-lock.json first (required for subsequent builds)
RUN npm install --package-lock-only 2>/dev/null || true

# Install Node dependencies with proper lockfile
RUN npm ci || npm install

# Copy source code
COPY . .

# Create non-root user for security
RUN addgroup -g 1001 -S runner && \
    adduser -S runner -u 1001 && \
    chown -R runner:runner /app /sandbox /tmp/executions

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Expose port
EXPOSE 3001

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start application
CMD ["npm", "start"]
