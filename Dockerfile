# Railway-optimized Dockerfile for LibreChat
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Copy package files first for better caching
COPY package*.json ./
COPY client/package*.json ./client/
COPY api/package*.json ./api/
COPY packages/data-provider/package*.json ./packages/data-provider/
COPY packages/data-schemas/package*.json ./packages/data-schemas/
COPY packages/api/package*.json ./packages/api/

# Install ALL dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Create librechat.yaml directly in the Dockerfile
RUN echo "Creating librechat.yaml..." && \
    echo "version: 1.2.1" > /app/librechat.yaml && \
    echo "cache: true" >> /app/librechat.yaml && \
    echo "organizations:" >> /app/librechat.yaml && \
    echo "  enabled: true" >> /app/librechat.yaml && \
    echo "  defaultPlan: \"starter\"" >> /app/librechat.yaml && \
    echo "jwt:" >> /app/librechat.yaml && \
    echo "  enabled: true" >> /app/librechat.yaml && \
    echo "  secret: \"\${JWT_SECRET}\"" >> /app/librechat.yaml && \
    echo "  refreshSecret: \"\${JWT_REFRESH_SECRET}\"" >> /app/librechat.yaml && \
    echo "  accessTokenExpiry: \"24h\"" >> /app/librechat.yaml && \
    echo "  refreshTokenExpiry: \"7d\"" >> /app/librechat.yaml && \
    echo "registration:" >> /app/librechat.yaml && \
    echo "  enabled: false" >> /app/librechat.yaml && \
    echo "  socialLogins: []" >> /app/librechat.yaml && \
    echo "  allowedDomains: []" >> /app/librechat.yaml

RUN echo "librechat.yaml created:" && ls -la /app/librechat.yaml && cat /app/librechat.yaml

# Build the application
RUN npm run build:data-provider
RUN npm run build:data-schemas
RUN npm run build:api
RUN npm run frontend

# Remove dev dependencies to reduce image size
RUN npm prune --production

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

# Expose port (Railway will set PORT env var)
EXPOSE 8080

# Health check with longer timeout and retries
HEALTHCHECK --interval=30s --timeout=30s --start-period=120s --retries=5 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Start the application
CMD ["/start.sh"] 