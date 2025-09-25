# Use stable Ubuntu-based Node.js image instead of Alpine
FROM node:18-bullseye-slim

# Set working directory
WORKDIR /app

# Update package lists and install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    make \
    g++ \
    git \
    curl \
    libvips-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set Python path
RUN ln -s /usr/bin/python3 /usr/bin/python

# Copy package files for better caching
COPY package*.json ./
COPY client/package*.json ./client/
COPY api/package*.json ./api/
COPY packages/data-provider/package*.json ./packages/data-provider/
COPY packages/data-schemas/package*.json ./packages/data-schemas/
COPY packages/api/package*.json ./packages/api/

# Clear npm cache and install dependencies
RUN npm cache clean --force
RUN npm ci --legacy-peer-deps --no-optional

# Copy source code
COPY . .

# Verify Henly AI integrations are present
RUN echo "✅ Verifying Henly AI files..." && \
    ls -la api/server/controllers/AuthController.js && \
    ls -la api/server/services/OrganizationMCP.js && \
    ls -la api/server/middleware/injectOrganization*.js && \
    echo "✅ All files present"

# Build LibreChat
RUN npm run build:data-provider
RUN npm run build:data-schemas
RUN npm run build:api
RUN npm run frontend

# Clean up
RUN npm prune --production
RUN apt-get autoremove -y && apt-get clean

# Create non-root user
RUN groupadd -r librechat && useradd -r -g librechat librechat
RUN chown -R librechat:librechat /app
USER librechat

# Expose port
EXPOSE 8080

# Start command
CMD ["npm", "run", "backend"]