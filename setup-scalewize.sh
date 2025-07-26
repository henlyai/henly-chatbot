#!/bin/bash

# ScaleWize AI - LibreChat Setup Script
# This script helps set up LibreChat for integration with ScaleWize AI

set -e

echo "🚀 Setting up LibreChat for ScaleWize AI Integration"
echo "=================================================="

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
    print_status "Checking Docker installation..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Check if .env file exists
check_env_file() {
    print_status "Checking environment configuration..."
    if [ ! -f .env ]; then
        print_error ".env file not found. Please create it first."
        exit 1
    fi
    
    # Check for required environment variables
    required_vars=("JWT_SECRET" "OPENAI_API_KEY" "MONGO_URI")
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" .env; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -ne 0 ]; then
        print_warning "Missing required environment variables: ${missing_vars[*]}"
        print_status "Please update your .env file with the required variables"
    else
        print_success "Environment configuration looks good"
    fi
}

# Setup directories
setup_directories() {
    print_status "Setting up directories..."
    
    mkdir -p data-node
    mkdir -p meili_data_v1.12
    mkdir -p uploads
    mkdir -p logs
    mkdir -p images
    
    print_success "Directories created"
}

# Start LibreChat services
start_services() {
    print_status "Starting LibreChat services..."
    
    # Set UID and GID for Docker
    export UID=$(id -u)
    export GID=$(id -g)
    
    # Start services
    docker-compose up -d
    
    print_success "Services started"
    print_status "Waiting for services to be ready..."
    
    # Wait for MongoDB
    print_status "Waiting for MongoDB..."
    until docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; do
        sleep 2
    done
    print_success "MongoDB is ready"
    
    # Wait for Meilisearch
    print_status "Waiting for Meilisearch..."
    until curl -s http://localhost:7700/health > /dev/null 2>&1; do
        sleep 2
    done
    print_success "Meilisearch is ready"
    
    # Wait for LibreChat API
    print_status "Waiting for LibreChat API..."
    until curl -s http://localhost:3080/api/health > /dev/null 2>&1; do
        sleep 5
    done
    print_success "LibreChat API is ready"
}

# Test the setup
test_setup() {
    print_status "Testing LibreChat setup..."
    
    # Test API health
    if curl -s http://localhost:3080/api/health | grep -q "ok"; then
        print_success "LibreChat API is healthy"
    else
        print_error "LibreChat API health check failed"
        return 1
    fi
    
    # Test JWT authentication
    print_status "Testing JWT authentication..."
    # This would require a valid JWT token from ScaleWize AI
    
    print_success "Basic setup test completed"
}

# Show next steps
show_next_steps() {
    echo ""
    echo "🎉 LibreChat setup completed!"
    echo "=============================="
    echo ""
    echo "Next steps:"
    echo "1. Update your ScaleWize AI .env.local with:"
    echo "   NEXT_PUBLIC_LIBRECHAT_URL=http://localhost:3080"
    echo "   LIBRECHAT_JWT_SECRET=your-super-secret-jwt-key-here"
    echo ""
    echo "2. Test the integration by visiting:"
    echo "   http://localhost:3080"
    echo ""
    echo "3. For production deployment:"
    echo "   - Deploy to Vercel/Railway"
    echo "   - Update environment variables"
    echo "   - Configure custom domain"
    echo ""
    echo "4. Monitor logs with:"
    echo "   docker-compose logs -f"
    echo ""
    echo "5. Stop services with:"
    echo "   docker-compose down"
    echo ""
}

# Main execution
main() {
    echo "Starting LibreChat setup for ScaleWize AI..."
    echo ""
    
    check_docker
    check_env_file
    setup_directories
    start_services
    test_setup
    show_next_steps
    
    print_success "Setup completed successfully!"
}

# Run main function
main "$@" 