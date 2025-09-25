# Use a specific working Node.js version
FROM node:18.19.0-alpine3.18

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++ git curl

# Copy package files for better caching
COPY package*.json ./
COPY client/package*.json ./client/
COPY api/package*.json ./api/
COPY packages/data-provider/package*.json ./packages/data-provider/
COPY packages/data-schemas/package*.json ./packages/data-schemas/
COPY packages/api/package*.json ./packages/api/

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build:data-provider
RUN npm run build:data-schemas
RUN npm run build:api
RUN npm run frontend

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "run", "backend"]