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

# Debug: Check if librechat.yaml exists
RUN ls -la | grep yaml || echo "No yaml files found"
RUN ls -la librechat.yaml || echo "librechat.yaml not found in root"

# Ensure librechat.yaml is in the correct location
RUN cp librechat.yaml /app/librechat.yaml || echo "Failed to copy librechat.yaml"
RUN ls -la /app/librechat.yaml || echo "librechat.yaml not found in /app"
RUN chmod 644 /app/librechat.yaml || echo "Failed to set permissions"
RUN cat /app/librechat.yaml | head -5 || echo "Failed to read librechat.yaml"

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