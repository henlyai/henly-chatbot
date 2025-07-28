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
    echo "version: 1.2.8" > /app/librechat.yaml && \
    echo "cache: true" >> /app/librechat.yaml && \
    echo "registration:" >> /app/librechat.yaml && \
    echo "  enabled: false" >> /app/librechat.yaml && \
    echo "  socialLogins: []" >> /app/librechat.yaml && \
    echo "  allowedDomains: []" >> /app/librechat.yaml && \
    echo "interface:" >> /app/librechat.yaml && \
    echo "  customWelcome: \"Welcome to LibreChat! Enjoy your experience.\"" >> /app/librechat.yaml && \
    echo "# MCP Servers Configuration" >> /app/librechat.yaml && \
    echo "mcpServers:" >> /app/librechat.yaml && \
    echo "  \"Google Drive\":" >> /app/librechat.yaml && \
    echo "    type: sse" >> /app/librechat.yaml && \
    echo "    url: https://mcp.pipedream.net/28971e50-c231-428a-97d9-803c981ade82/google_drive" >> /app/librechat.yaml && \
    echo "    timeout: 30000" >> /app/librechat.yaml && \
    echo "  \"Slack\":" >> /app/librechat.yaml && \
    echo "    type: sse" >> /app/librechat.yaml && \
    echo "    url: https://mcp.pipedream.net/28971e50-c231-428a-97d9-803c981ade82/slack" >> /app/librechat.yaml && \
    echo "    timeout: 30000" >> /app/librechat.yaml

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
    CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["/start.sh"] 