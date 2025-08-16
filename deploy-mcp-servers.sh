#!/bin/bash

# ScaleWize AI MCP Servers Deployment Script
# This script helps deploy custom MCP servers for Google Drive and other services

set -e

echo "🚀 ScaleWize AI MCP Servers Deployment"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    print_success "Docker is installed"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi
    print_success "Node.js is installed"
}

# Build Google Drive MCP Server
build_google_drive_mcp() {
    print_status "Building Google Drive MCP Server..."
    
    cd custom-mcp-servers/google-drive-mcp
    
    # Install dependencies
    print_status "Installing dependencies..."
    npm install
    
    # Build the project
    print_status "Building project..."
    npm run build
    
    # Build Docker image
    print_status "Building Docker image..."
    docker build -t scalewize-google-drive-mcp .
    
    cd ../..
    print_success "Google Drive MCP Server built successfully"
}

# Deploy Google Drive MCP Server
deploy_google_drive_mcp() {
    print_status "Deploying Google Drive MCP Server..."
    
    # Stop existing container if running
    docker stop scalewize-google-drive-mcp 2>/dev/null || true
    docker rm scalewize-google-drive-mcp 2>/dev/null || true
    
    # Run the container
    docker run -d \
        --name scalewize-google-drive-mcp \
        --network host \
        --env-file custom-mcp-servers/google-drive-mcp/.env \
        --restart unless-stopped \
        scalewize-google-drive-mcp
    
    print_success "Google Drive MCP Server deployed successfully"
}

# Check Google Drive MCP Server health
check_google_drive_mcp_health() {
    print_status "Checking Google Drive MCP Server health..."
    
    # Wait for server to start
    sleep 5
    
    # Check health endpoint
    if curl -f http://localhost:3001/health > /dev/null 2>&1; then
        print_success "Google Drive MCP Server is healthy"
    else
        print_error "Google Drive MCP Server health check failed"
        print_status "Checking logs..."
        docker logs scalewize-google-drive-mcp
        exit 1
    fi
}

# Setup environment variables
setup_env() {
    print_status "Setting up environment variables..."
    
    if [ ! -f custom-mcp-servers/google-drive-mcp/.env ]; then
        print_warning "Environment file not found. Creating from template..."
        cp custom-mcp-servers/google-drive-mcp/env.example custom-mcp-servers/google-drive-mcp/.env
        print_warning "Please edit custom-mcp-servers/google-drive-mcp/.env with your Google API credentials"
        print_warning "You need to:"
        print_warning "1. Create a Google Cloud Project"
        print_warning "2. Enable Google Drive API"
        print_warning "3. Create OAuth 2.0 credentials"
        print_warning "4. Add the credentials to the .env file"
        exit 1
    fi
    
    print_success "Environment variables configured"
}

# Main deployment function
main() {
    print_status "Starting MCP servers deployment..."
    
    # Check prerequisites
    check_docker
    check_node
    
    # Setup environment
    setup_env
    
    # Build and deploy Google Drive MCP
    build_google_drive_mcp
    deploy_google_drive_mcp
    check_google_drive_mcp_health
    
    print_success "All MCP servers deployed successfully!"
    echo ""
    print_status "Next steps:"
    print_status "1. Update your LibreChat configuration to use the new MCP servers"
    print_status "2. Restart LibreChat to pick up the new configuration"
    print_status "3. Test the Google Drive integration in your chatbot"
    echo ""
    print_status "MCP Server URLs:"
    print_status "- Google Drive: http://localhost:3001/sse"
    print_status "- Health Check: http://localhost:3001/health"
}

# Handle script arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "build")
        check_docker
        check_node
        build_google_drive_mcp
        ;;
    "health")
        check_google_drive_mcp_health
        ;;
    "logs")
        docker logs scalewize-google-drive-mcp
        ;;
    "stop")
        docker stop scalewize-google-drive-mcp
        docker rm scalewize-google-drive-mcp
        print_success "MCP servers stopped"
        ;;
    "restart")
        docker restart scalewize-google-drive-mcp
        print_success "MCP servers restarted"
        ;;
    *)
        echo "Usage: $0 {deploy|build|health|logs|stop|restart}"
        echo "  deploy  - Build and deploy all MCP servers (default)"
        echo "  build   - Build MCP servers only"
        echo "  health  - Check MCP server health"
        echo "  logs    - Show MCP server logs"
        echo "  stop    - Stop MCP servers"
        echo "  restart - Restart MCP servers"
        exit 1
        ;;
esac 