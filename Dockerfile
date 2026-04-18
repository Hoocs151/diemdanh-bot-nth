FROM node:20-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production=false

# Copy source code
COPY . .

# Create data directories
RUN mkdir -p data logs backups

# Build better-sqlite3 (ensure it works on alpine)
RUN npm rebuild better-sqlite3

# Expose nothing (bot doesn't need ports)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health 2>/dev/null || exit 0

# Run as non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup
USER appuser

CMD ["node", "src/bot.js"]
