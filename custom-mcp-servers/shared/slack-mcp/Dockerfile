# Use Node.js 20 for better Supabase compatibility
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Prune production dependencies
RUN npm prune --production

# Expose port
EXPOSE 3002

# Start the server
CMD ["npm", "start"] 