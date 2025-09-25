# Railway-optimized Dockerfile for Henly AI LibreChat
# Supports iframe authentication, Supabase integration, and organization-based MCP loading
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies required for LibreChat + Supabase integrations
RUN apk add --no-cache \
    python3 \
    py3-pip \
    make \
    g++ \
    git \
    curl \
    vips-dev \
    ca-certificates \
    && ln -sf python3 /usr/bin/python

# Copy package files for better Docker layer caching
COPY package*.json ./
COPY client/package*.json ./client/
COPY api/package*.json ./api/
COPY packages/data-provider/package*.json ./packages/data-provider/
COPY packages/data-schemas/package*.json ./packages/data-schemas/
COPY packages/api/package*.json ./packages/api/

# Install ALL dependencies (including dev dependencies needed for build)
# Using legacy-peer-deps for LibreChat's complex dependency tree
RUN npm ci --legacy-peer-deps

# Copy ALL source code including Henly AI custom integrations
COPY . .

# Verify critical Henly AI files are present
RUN echo "🔍 Verifying Henly AI custom integrations..." && \
    echo "✅ SSO Controller:" && ls -la api/server/controllers/AuthController.js && \
    echo "✅ Organization MCP Service:" && ls -la api/server/services/OrganizationMCP.js && \
    echo "✅ Agent Injection Middleware:" && ls -la api/server/middleware/injectOrganizationAgents.js && \
    echo "✅ Prompt Injection Middleware:" && ls -la api/server/middleware/injectOrganizationPrompts.js && \
    echo "✅ Supabase Sync Middleware:" && ls -la api/server/middleware/syncToSupabase.js && \
    echo "✅ Default Org Context Middleware:" && ls -la api/server/middleware/defaultOrgContext.js && \
    echo "✅ Debug Middleware:" && ls -la api/server/middleware/debugLibreChat.js && \
    echo "✅ LibreChat Config:" && ls -la librechat.yaml && \
    echo "🎯 All Henly AI integrations verified!"

# Verify mcpServers is enabled in config
RUN echo "🔍 Checking librechat.yaml configuration..." && \
    grep -A5 -B5 "mcpServers" librechat.yaml || echo "⚠️  mcpServers not found in config" && \
    grep -A5 -B5 "agents:" librechat.yaml || echo "⚠️  agents config not found" && \
    grep -A5 -B5 "prompts:" librechat.yaml || echo "⚠️  prompts config not found"

# Build LibreChat with all packages in correct dependency order
RUN echo "🏗️  Building LibreChat data-provider..." && npm run build:data-provider
RUN echo "🏗️  Building LibreChat data-schemas..." && npm run build:data-schemas
RUN echo "🏗️  Building LibreChat API..." && npm run build:api
RUN echo "🏗️  Building LibreChat frontend..." && npm run frontend

# Remove dev dependencies to reduce image size (keep production deps for Supabase)
RUN npm prune --production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S librechat -u 1001 && \
    chown -R librechat:nodejs /app
USER librechat

# Expose port (Railway automatically sets PORT env var)
EXPOSE 8080

# Health check specifically for LibreChat with longer timeout for startup
HEALTHCHECK --interval=30s --timeout=15s --start-period=180s --retries=5 \
    CMD curl -f http://localhost:8080/ || exit 1

# Print reminder about critical environment variables
RUN echo "🔧 REMINDER: Set these Railway environment variables:" && \
    echo "  - SUPABASE_URL" && \
    echo "  - SUPABASE_ANON_KEY" && \
    echo "  - DEFAULT_ORGANIZATION_ID" && \
    echo "  - JWT_SECRET" && \
    echo "📋 Required for iframe auth and MCP loading!"

# Copy and setup startup script
COPY start-henly.sh /start-henly.sh
RUN chmod +x /start-henly.sh

# Start LibreChat backend with Henly AI environment validation
CMD ["/start-henly.sh"]